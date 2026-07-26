/**
 * Verificação ao vivo do motor de orçamento (Milestone 14) contra um Postgres
 * real. O que esta rotina cobre e nenhum teste unitário cobre:
 *
 *  - GRANT + RLS: as tabelas novas são acessíveis via PostgREST como
 *    `authenticated` (a Milestone 13 descobriu que RLS não substitui GRANT);
 *  - numeração sequencial por organização, inclusive isolada entre orgs;
 *  - encadeamento de revisão e recusa de duas revisões da mesma versão;
 *  - imutabilidade do documento emitido (triggers do banco);
 *  - constraint de snapshot completo (rascunho tudo nulo, emitido tudo cheio);
 *  - o invariante central: DELETAR `tax_types` / `payment_conditions` não
 *    altera nem quebra um documento já emitido;
 *  - isolamento entre organizações.
 *
 * Uso: `npx supabase start && npx supabase db reset && npx tsx scripts/verify-quote-engine.mts`
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail)}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(`${label} → ${String(actual)}`, actual === expected, { actual, expected });
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function signUpUser(email: string): Promise<SupabaseClient> {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
    user_metadata: { full_name: `Vendedor ${email.split("@")[0]}` },
  });
  if (createError) throw new Error(`createUser: ${createError.message}`);

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "senha-de-teste-123",
  });
  if (error) throw new Error(`signIn: ${error.message}`);
  return client;
}

async function setupOrganization(client: SupabaseClient, name: string, slug: string) {
  const { data: org, error } = await client.rpc("create_organization", {
    org_name: name,
    org_slug: slug,
  });
  if (error || !org) throw new Error(`create_organization: ${error?.message}`);
  const orgId = (org as { id: string }).id;

  const footer = "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.";
  await client.from("tax_settings").insert({ org_id: orgId, document_footer: footer });

  // Cenário "ICMS + IPI padrão" do briefing §6.
  const { data: taxTypes, error: taxError } = await client
    .from("tax_types")
    .insert([
      {
        org_id: orgId,
        code: "ICMS",
        label: "ICMS",
        mode: "exclusive",
        default_rate: 18,
        display_order: 1,
      },
      {
        org_id: orgId,
        code: "IPI",
        label: "IPI",
        mode: "inclusive",
        default_rate: 0,
        display_order: 2,
      },
    ])
    .select("id, code");
  if (taxError || !taxTypes) throw new Error(`tax_types: ${taxError?.message}`);
  const icmsId = taxTypes.find((t) => t.code === "ICMS")!.id;
  const ipiId = taxTypes.find((t) => t.code === "IPI")!.id;

  const { data: category } = await client
    .from("product_categories")
    .insert({ org_id: orgId, name: "Ferramentas" })
    .select("id")
    .single();
  const categoryId = category!.id;

  const { data: products, error: productError } = await client
    .from("products")
    .insert([
      {
        org_id: orgId,
        external_code: "PRD-001",
        name: "Furadeira",
        price: "100.000000",
        category_id: categoryId,
      },
      {
        org_id: orgId,
        external_code: "PRD-002",
        name: "Serra ST",
        price: "200.000000",
        category_id: categoryId,
      },
    ])
    .select("id, external_code");
  if (productError || !products) throw new Error(`products: ${productError?.message}`);
  const furadeira = products.find((p) => p.external_code === "PRD-001")!.id;
  const serra = products.find((p) => p.external_code === "PRD-002")!.id;

  // IPI 5% por categoria; ICMS zerado por ST no produto (override que vence).
  await client.from("tax_rates").insert([
    { tax_type_id: ipiId, category_id: categoryId, rate: 5 },
    {
      tax_type_id: icmsId,
      product_id: serra,
      rate: 0,
      note: "ICMS-ST recolhido pelo fabricante",
    },
  ]);

  // Todas as colunas em todos os objetos: num insert em lote o PostgREST
  // normaliza o conjunto de colunas e manda NULL onde a chave falta, em vez de
  // deixar o DEFAULT da coluna agir.
  const { data: conditions, error: conditionError } = await client
    .from("payment_conditions")
    .insert([
      {
        org_id: orgId,
        label: "À vista (PIX ou dinheiro)",
        kind: "a_vista",
        discount_percent: 5,
        installments: 1,
        term_days: 0,
        display_order: 1,
      },
      {
        org_id: orgId,
        label: "Boleto",
        kind: "boleto",
        discount_percent: 0,
        installments: 1,
        term_days: 15,
        display_order: 2,
      },
    ])
    .select("id, label");
  if (conditionError || !conditions)
    throw new Error(`payment_conditions: ${conditionError?.message}`);

  const { data: band } = await client
    .from("payment_value_bands")
    .insert({ org_id: orgId, label: "Até R$ 5.000,00", min_value: 0, max_value: 5000 })
    .select("id")
    .single();

  await client.from("payment_band_conditions").insert(
    conditions.map((condition) => ({
      band_id: band!.id,
      payment_condition_id: condition.id,
    })),
  );

  return {
    orgId,
    icmsId,
    ipiId,
    categoryId,
    furadeira,
    serra,
    conditionAVista: conditions.find((c) => c.label === "À vista (PIX ou dinheiro)")!.id,
    footer,
  };
}

function draftPayload(setup: Awaited<ReturnType<typeof setupOrganization>>) {
  return {
    p_org_id: setup.orgId,
    p_quote: {
      status: "gerado",
      owner_id: null,
      customer_id: null,
      customer_name: "Padaria Bom Pão",
      customer_document: "12.345.678/0001-90",
      customer_source_id: "crm",
      discount_type: "fixed",
      discount_value: "0.000000",
      payment_condition_id: setup.conditionAVista,
      expires_at: "2026-08-25",
    },
    p_items: [
      {
        product_id: setup.furadeira,
        product_external_code: "PRD-001",
        product_name: "Furadeira",
        category_id_snapshot: setup.categoryId,
        category_name: "Ferramentas",
        quantity: "7.000000",
      },
    ],
    p_previous_revision_id: null,
  };
}

async function main() {
  const stamp = Date.now();
  console.log("\n== setup ==");
  const client = await signUpUser(`vendedor.${stamp}@metrapex.test`);
  const setup = await setupOrganization(client, `Metrapex ${stamp}`, `metrapex-${stamp}`);
  console.log(`  organização ${setup.orgId}`);

  console.log("\n== GRANT + RLS nas tabelas novas ==");
  for (const table of [
    "payment_conditions",
    "payment_value_bands",
    "payment_band_conditions",
    "quotes",
    "quote_items",
    "quote_item_taxes",
    "quote_sequences",
  ] as const) {
    const { error } = await client.from(table).select("*").limit(1);
    check(`select em ${table} sem "permission denied"`, !error, error?.message);
  }

  console.log("\n== numeração sequencial por organização ==");
  const { data: first, error: firstError } = await client.rpc(
    "save_quote_draft",
    draftPayload(setup),
  );
  check("save_quote_draft cria o rascunho", !firstError && Boolean(first), firstError?.message);
  const quote = first as { id: string; sequence: number; revision: number };
  eq("sequence do primeiro orçamento", quote.sequence, 1);
  eq("revision do primeiro orçamento", quote.revision, 1);

  const { data: second } = await client.rpc("save_quote_draft", draftPayload(setup));
  eq("sequence do segundo orçamento", (second as { sequence: number }).sequence, 2);

  console.log("\n== rascunho guarda entrada, não resultado (§11.3) ==");
  const { data: draftRow } = await client
    .from("quotes")
    .select("subtotal, total, discount_amount, payment_discount_amount, tax_snapshot_at")
    .eq("id", quote.id)
    .single();
  check(
    "rascunho tem todos os totais nulos",
    draftRow!.subtotal === null &&
      draftRow!.total === null &&
      draftRow!.discount_amount === null &&
      draftRow!.payment_discount_amount === null &&
      draftRow!.tax_snapshot_at === null,
    draftRow,
  );

  const { data: draftItem } = await client
    .from("quote_items")
    .select("position, quantity, unit_price_charged, line_total, category_name")
    .eq("quote_id", quote.id)
    .single();
  eq("quantidade fracionária preservada", Number(draftItem!.quantity), 7);
  eq("categoria copiada para o item (§11.5)", draftItem!.category_name, "Ferramentas");
  check(
    "item de rascunho sem valor de dinheiro",
    draftItem!.unit_price_charged === null && draftItem!.line_total === null,
    draftItem,
  );

  console.log("\n== constraint de snapshot parcial ==");
  const { error: partialError } = await client
    .from("quote_items")
    .update({ unit_price_charged: "100.000000" })
    .eq("quote_id", quote.id);
  check(
    "recusa item com dinheiro pela metade",
    Boolean(partialError),
    partialError?.message ?? "aceitou!",
  );

  console.log("\n== emissão congela o documento ==");
  // 7 × 100 com IPI 5% embutido, cálculo POR LINHA (briefing §5) e ICMS 18%
  // por fora. Números conferidos contra a matriz de casos fiscais.
  const { error: issueError } = await client.rpc("issue_quote", {
    p_quote_id: quote.id,
    p_items: [
      {
        position: 1,
        unit_price_charged: "100.000000",
        unit_base_display: "95.238095",
        line_total: "826.000000",
        taxes: [
          {
            tax_type_id: setup.icmsId,
            tax_code: "ICMS",
            tax_label: "ICMS",
            mode: "exclusive",
            rate_applied: "18.0000",
            rate_source: "org_default",
            note: null,
            base_amount: "700.000000",
            tax_amount: "126.000000",
            display_order: 1,
          },
          {
            tax_type_id: setup.ipiId,
            tax_code: "IPI",
            tax_label: "IPI",
            mode: "inclusive",
            rate_applied: "5.0000",
            rate_source: "category",
            note: null,
            base_amount: "666.666667",
            tax_amount: "33.333333",
            display_order: 2,
          },
        ],
      },
    ],
    p_snapshot: {
      subtotal: "700.000000",
      total: "784.700000",
      discount_amount: "0.000000",
      payment_discount_amount: "41.300000",
      payment_condition_label: "À vista (PIX ou dinheiro)",
      payment_condition_kind: "a_vista",
      payment_condition_discount_percent: "5.0000",
      payment_condition_installments: 1,
      payment_condition_term_days: 0,
      payment_band_label: "Até R$ 5.000,00",
      tax_footer_note: setup.footer,
      show_tax_lines: true,
    },
  });
  check("issue_quote grava o snapshot", !issueError, issueError?.message);

  const { data: issued } = await client.from("quotes").select("*").eq("id", quote.id).single();
  check("tax_snapshot_at preenchido", issued!.tax_snapshot_at !== null);
  eq("rodapé copiado da configuração", issued!.tax_footer_note, setup.footer);
  eq("condição de pagamento copiada", issued!.payment_condition_label, "À vista (PIX ou dinheiro)");
  eq("total congelado", Number(issued!.total), 784.7);

  const { data: issuedTaxes } = await client
    .from("quote_item_taxes")
    .select("tax_code, rate_source, base_amount, tax_amount")
    .eq(
      "quote_item_id",
      (await client.from("quote_items").select("id").eq("quote_id", quote.id).single()).data!.id,
    )
    .order("display_order");
  eq("duas linhas de tributo no snapshot", issuedTaxes!.length, 2);
  eq("base do IPI calculada por linha", Number(issuedTaxes![1].base_amount), 666.666667);
  eq("rate_source do IPI", issuedTaxes![1].rate_source, "category");

  console.log("\n== issue_quote recusa contagem de itens divergente ==");
  // Regressão do achado da revisão: um payload que omite item do orçamento não
  // pode congelar em silêncio um documento com item pela metade.
  const { data: twoItemDraft } = await client.rpc("save_quote_draft", {
    ...draftPayload(setup),
    p_items: [
      draftPayload(setup).p_items[0],
      {
        product_id: setup.serra,
        product_external_code: "PRD-002",
        product_name: "Serra ST",
        category_id_snapshot: setup.categoryId,
        category_name: "Ferramentas",
        quantity: "1.000000",
      },
    ],
  });
  const { error: partialIssueError } = await client.rpc("issue_quote", {
    p_quote_id: (twoItemDraft as { id: string }).id,
    p_items: [
      {
        position: 1,
        unit_price_charged: "100.000000",
        unit_base_display: "95.238095",
        line_total: "826.000000",
        taxes: [],
      },
    ],
    p_snapshot: {
      subtotal: "700.000000",
      total: "700.000000",
      discount_amount: "0.000000",
      payment_discount_amount: "0.000000",
      payment_condition_label: null,
      payment_condition_kind: null,
      payment_condition_discount_percent: null,
      payment_condition_installments: null,
      payment_condition_term_days: null,
      payment_band_label: null,
      tax_footer_note: setup.footer,
      show_tax_lines: true,
    },
  });
  check(
    "recusa emitir com menos itens no snapshot do que no orçamento",
    Boolean(partialIssueError),
    partialIssueError?.message ?? "aceitou!",
  );

  console.log("\n== snapshot protege contra mudança de preço e alíquota no catálogo ==");
  // Diferente da seção "fotografia" abaixo (que APAGA a configuração): aqui a
  // configuração continua existindo, só muda de valor — é o caminho mais
  // comum na vida real (reajuste de preço, alíquota corrigida) e o snapshot
  // tem que ignorá-lo do mesmo jeito.
  const beforeItemId = (
    await client.from("quote_items").select("id").eq("quote_id", quote.id).single()
  ).data!.id;
  const { data: beforeTaxes } = await client
    .from("quote_item_taxes")
    .select("tax_code, rate_applied, base_amount, tax_amount")
    .eq("quote_item_id", beforeItemId)
    .order("display_order");

  await admin.from("products").update({ price: "250.000000" }).eq("id", setup.furadeira);
  await admin
    .from("tax_rates")
    .update({ rate: 40 })
    .eq("tax_type_id", setup.ipiId)
    .eq("category_id", setup.categoryId);
  await admin.from("tax_types").update({ default_rate: 99 }).eq("id", setup.icmsId);

  const { data: afterPriceChange } = await client
    .from("quotes")
    .select("subtotal, total, discount_amount")
    .eq("id", quote.id)
    .single();
  eq(
    "subtotal continua 700,00 mesmo com preço do produto a R$250",
    Number(afterPriceChange!.subtotal),
    700,
  );
  eq(
    "total continua 784,70 mesmo com preço do produto a R$250",
    Number(afterPriceChange!.total),
    784.7,
  );

  const { data: afterItem } = await client
    .from("quote_items")
    .select("unit_price_charged, unit_base_display, line_total")
    .eq("id", beforeItemId)
    .single();
  eq(
    "unit_price_charged continua R$100 (catálogo agora diz R$250)",
    Number(afterItem!.unit_price_charged),
    100,
  );

  const { data: afterTaxes } = await client
    .from("quote_item_taxes")
    .select("tax_code, rate_applied, base_amount, tax_amount")
    .eq("quote_item_id", beforeItemId)
    .order("display_order");
  check(
    "linhas de tributo idênticas às de antes da mudança de alíquota",
    JSON.stringify(afterTaxes) === JSON.stringify(beforeTaxes),
    { antes: beforeTaxes, depois: afterTaxes },
  );
  const icmsAfter = afterTaxes!.find((t) => t.tax_code === "ICMS")!;
  eq(
    "rate_applied do ICMS continua 18,0000 (org agora usa 99%)",
    Number(icmsAfter.rate_applied),
    18,
  );
  const ipiAfter = afterTaxes!.find((t) => t.tax_code === "IPI")!;
  eq(
    "rate_applied do IPI continua 5,0000 (categoria agora usa 40%)",
    Number(ipiAfter.rate_applied),
    5,
  );

  console.log("\n== documento emitido é imutável ==");
  const { error: rewriteTotal } = await client
    .from("quotes")
    .update({ status: "enviado" })
    .eq("id", quote.id);
  check("metadado de pipeline continua editável (status)", !rewriteTotal, rewriteTotal?.message);

  const { error: rewriteItem } = await client
    .from("quote_items")
    .update({ quantity: "9.000000" })
    .eq("quote_id", quote.id);
  check("recusa alterar item emitido", Boolean(rewriteItem), rewriteItem?.message ?? "aceitou!");

  const { error: deleteTax } = await admin
    .from("quote_item_taxes")
    .delete()
    .eq(
      "quote_item_id",
      (await client.from("quote_items").select("id").eq("quote_id", quote.id).single()).data!.id,
    );
  check(
    "recusa apagar linha de tributo emitida",
    Boolean(deleteTax),
    deleteTax?.message ?? "aceitou!",
  );

  console.log("\n== revisão: registro novo, anterior congelada ==");
  const { data: revision, error: revisionError } = await client.rpc("save_quote_draft", {
    ...draftPayload(setup),
    p_quote: {
      ...draftPayload(setup).p_quote,
      discount_type: "percent",
      discount_value: "10.000000",
    },
    p_previous_revision_id: quote.id,
  });
  check("cria a revisão", !revisionError && Boolean(revision), revisionError?.message);
  const rev = revision as { id: string; sequence: number; revision: number };
  eq("revisão herda a sequência do orçamento", rev.sequence, quote.sequence);
  eq("revisão incrementa o número de revisão", rev.revision, 2);

  // "Anterior continua íntegra": não só o total, todo o pacote congelado na
  // emissão — se qualquer um desses tivesse sido tocado pela criação da
  // revisão, a trigger de imutabilidade já teria barrado a escrita, mas aqui
  // conferimos o resultado observável.
  const { data: superseded } = await client
    .from("quotes")
    .select(
      "superseded_by_revision_id, subtotal, total, discount_amount, payment_condition_label, tax_snapshot_at, status",
    )
    .eq("id", quote.id)
    .single();
  eq("versão anterior aponta para a nova", superseded!.superseded_by_revision_id, rev.id);
  eq(
    "versão anterior segue emitida (tax_snapshot_at preenchido)",
    superseded!.tax_snapshot_at !== null,
    true,
  );
  eq("versão anterior: subtotal intacto", Number(superseded!.subtotal), 700);
  eq(
    "versão anterior: total intacto (não herdou o desconto de 10% da revisão)",
    Number(superseded!.total),
    784.7,
  );
  eq("versão anterior: discount_amount intacto", Number(superseded!.discount_amount), 0);
  eq(
    "versão anterior: condição de pagamento intacta",
    superseded!.payment_condition_label,
    "À vista (PIX ou dinheiro)",
  );

  // "Só a nova está marcada como atual": a revisão nova não tem
  // `superseded_by_revision_id` (ninguém a substituiu ainda) — é isso que o
  // board do Kanban usa para mostrar só uma linha por orçamento.
  const { data: revRow } = await client
    .from("quotes")
    .select("superseded_by_revision_id, previous_revision_id, discount_type, discount_value")
    .eq("id", rev.id)
    .single();
  eq("revisão nova é a atual (sem substituta)", revRow!.superseded_by_revision_id, null);
  eq("revisão nova aponta para a anterior", revRow!.previous_revision_id, quote.id);
  eq("revisão nova guarda o desconto negociado (percent)", revRow!.discount_type, "percent");
  eq("revisão nova guarda o desconto negociado (10%)", Number(revRow!.discount_value), 10);

  const { error: doubleRevision } = await client.rpc("save_quote_draft", {
    ...draftPayload(setup),
    p_previous_revision_id: quote.id,
  });
  check(
    "recusa uma segunda revisão da mesma versão",
    Boolean(doubleRevision),
    doubleRevision?.message ?? "aceitou!",
  );

  console.log("\n== fotografia: apagar a configuração não muda o documento ==");
  await client.from("tax_rates").delete().eq("tax_type_id", setup.ipiId);
  await client.from("tax_types").delete().eq("org_id", setup.orgId);
  await client
    .from("payment_band_conditions")
    .delete()
    .eq("payment_condition_id", setup.conditionAVista);
  await client.from("payment_conditions").delete().eq("org_id", setup.orgId);
  await client.from("tax_settings").delete().eq("org_id", setup.orgId);

  const { data: afterWipeQuote, error: afterWipeError } = await client
    .from("quotes")
    .select("total, payment_condition_label, tax_footer_note")
    .eq("id", quote.id)
    .single();
  check("documento emitido segue legível", !afterWipeError, afterWipeError?.message);
  eq("total inalterado", Number(afterWipeQuote!.total), 784.7);
  eq("condição inalterada", afterWipeQuote!.payment_condition_label, "À vista (PIX ou dinheiro)");
  eq("rodapé inalterado", afterWipeQuote!.tax_footer_note, setup.footer);

  const { data: afterWipeTaxes } = await client
    .from("quote_items")
    .select("line_total, quote_item_taxes(tax_code, tax_label, rate_applied, tax_amount)")
    .eq("quote_id", quote.id)
    .returns<
      { line_total: string; quote_item_taxes: { tax_code: string; tax_amount: string }[] }[]
    >();
  eq(
    "linhas de tributo sobrevivem à exclusão do tributo",
    afterWipeTaxes![0].quote_item_taxes.length,
    2,
  );

  console.log("\n== isolamento entre organizações ==");
  const other = await signUpUser(`intruso.${stamp}@metrapex.test`);
  await other.rpc("create_organization", {
    org_name: `Outra ${stamp}`,
    org_slug: `outra-${stamp}`,
  });

  const { data: leakedQuotes } = await other.from("quotes").select("id");
  eq("outra organização não vê orçamento alheio", leakedQuotes?.length ?? 0, 0);

  const { data: leakedItems } = await other.from("quote_items").select("id");
  eq("outra organização não vê item alheio", leakedItems?.length ?? 0, 0);

  const { data: otherSeq, error: otherSeqError } = await other.rpc("save_quote_draft", {
    ...draftPayload(setup),
    p_org_id: (await other.from("organizations").select("id").single()).data!.id,
    p_items: [],
  });
  check(
    "numeração da outra organização começa em 1",
    !otherSeqError && (otherSeq as { sequence: number })?.sequence === 1,
    otherSeqError?.message ?? otherSeq,
  );

  const { error: crossOrgError } = await other.rpc("save_quote_draft", draftPayload(setup));
  check(
    "recusa gravar orçamento na organização alheia",
    Boolean(crossOrgError),
    crossOrgError?.message ?? "aceitou!",
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
