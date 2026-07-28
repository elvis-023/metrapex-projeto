/**
 * Verificação ao vivo do cadastro de clientes (Milestone 17) contra um
 * Postgres real. O que esta rotina cobre e nenhum teste unitário cobre:
 *
 *  - CHECK de formato de documento (`customers_document_digits`) recusa
 *    documento fora de 11/14 dígitos até num insert direto;
 *  - `upsert_customer` deduplica por (org_id, document): cadastrar de novo o
 *    mesmo CNPJ não cria um segundo registro, atualiza o existente;
 *  - `upsert_customer` recusa organização que não é do usuário autenticado;
 *  - `address` é preservado (COALESCE) quando uma chamada não informa
 *    endereço, mas name/email/phone são sobrescritos (mesma convenção de
 *    `upsert_public_customer`);
 *  - `upsert_customer_contact` deduplica por (customer_id, email) — mesmo
 *    e-mail atualiza nome/telefone em vez de duplicar contato;
 *  - contato sem e-mail nunca deduplica (cada chamada cria uma linha nova);
 *  - `upsert_public_customer` (formulário público) agora também grava/
 *    atualiza um contato a partir do `contactName` da submissão;
 *  - RLS: membro de uma organização não enxerga nem edita cliente/contato de
 *    outra organização;
 *  - GRANT + RLS em `customer_contacts` para o client autenticado;
 *  - isolamento entre organizações no `upsert_customer`/`upsert_customer_contact`.
 *
 * Uso: `npx supabase start && npx supabase db reset && npx tsx scripts/verify-customers-backend.mts`
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

async function signUpUser(
  email: string,
  fullName: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-123",
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !data.user) throw new Error(`createUser: ${createError?.message}`);

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "senha-de-teste-123" });
  if (error) throw new Error(`signIn: ${error.message}`);
  return { client, userId: data.user.id };
}

/** CNPJ com dígito verificador válido a partir de um prefixo de 12 dígitos — mesma fórmula de lib/public-form/cpf-cnpj.ts. */
function buildTestCnpj(base12: string): string {
  function checkDigit(digits: string, weights: number[]): number {
    const sum = digits
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }
  const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base = base12.padStart(12, "0").slice(0, 12);
  const d1 = checkDigit(base, W1);
  const d2 = checkDigit(base + d1, W2);
  return `${base}${d1}${d2}`;
}

async function main() {
  const stamp = Date.now();
  const cnpj = buildTestCnpj(String(stamp).slice(-12));

  console.log("\n== setup ==");
  const { client: adminUser } = await signUpUser(`admin.${stamp}@metrapex.test`, "Admin Um");
  const { data: org, error: orgError } = await adminUser.rpc("create_organization", {
    org_name: `Metrapex Clientes ${stamp}`,
    org_slug: `metrapex-clientes-${stamp}`,
  });
  if (orgError || !org) throw new Error(`create_organization: ${orgError?.message}`);
  const orgId = (org as { id: string }).id;

  const { client: intruder } = await signUpUser(`intruso.${stamp}@metrapex.test`, "Intruso");
  const { data: otherOrg, error: otherOrgError } = await intruder.rpc("create_organization", {
    org_name: `Outra Org ${stamp}`,
    org_slug: `outra-org-${stamp}`,
  });
  if (otherOrgError || !otherOrg)
    throw new Error(`create_organization (outra org): ${otherOrgError?.message}`);
  const otherOrgId = (otherOrg as { id: string }).id;

  console.log("\n== CHECK de formato de documento ==");
  const { error: badDigitsError } = await admin
    .from("customers")
    .insert({ org_id: orgId, document: "123", name: "Documento curto" });
  check(
    "recusa documento com menos de 11/14 dígitos (CHECK constraint)",
    Boolean(badDigitsError),
    badDigitsError?.message ?? "aceitou!",
  );

  console.log(
    "\n== máscara: DB recusa documento não normalizado direto (defesa em profundidade) ==",
  );
  // Quem tira a máscara é `normalizeDocument` (lib/public-form/cpf-cnpj.ts),
  // chamado por `lib/customers/actions.ts` ANTES de qualquer chamada a este
  // RPC — coberto por unit test em lib/public-form/cpf-cnpj.test.ts (mascarado
  // e sem máscara colapsam nos mesmos dígitos). Aqui provamos a outra metade
  // do contrato: se a máscara chegasse até o banco sem passar por aquela
  // normalização, a CHECK constraint barra o insert — não é "por sorte" que
  // funciona, é uma invariante de banco.
  const maskedCnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const { error: maskedRpcError } = await adminUser.rpc("upsert_customer", {
    p_org_id: orgId,
    p_document: maskedCnpj,
    p_name: "Tentativa com máscara",
    p_email: null,
    p_phone: null,
    p_address: null,
  });
  check(
    "upsert_customer recusa documento COM máscara (CHECK constraint)",
    Boolean(maskedRpcError),
    maskedRpcError?.message ?? "aceitou!",
  );

  console.log(
    "\n== upsert_customer deduplica por (org_id, document) — mesmo CNPJ com e sem máscara ==",
  );
  const { data: created, error: createError } = await adminUser.rpc("upsert_customer", {
    p_org_id: orgId,
    // Dígitos que `normalizeDocument("${maskedCnpj}")` produziria — é este
    // valor, já sem máscara, que a Server Action de fato manda ao banco.
    p_document: cnpj,
    p_name: "Padaria Bom Pão",
    p_email: "contato@padaria.test",
    p_phone: "11999990000",
    p_address: {
      zip: "01000-000",
      street: "Rua Um",
      number: "10",
      complement: "",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
    },
  });
  check("cria o cliente", !createError && Boolean(created), createError?.message);
  const customerId = (created as { id: string }).id;

  const { data: updated, error: updateError } = await adminUser.rpc("upsert_customer", {
    p_org_id: orgId,
    p_document: cnpj,
    p_name: "Padaria Bom Pão Ltda",
    p_email: "financeiro@padaria.test",
    p_phone: "11988880000",
    p_address: null,
  });
  check(
    "cadastrar de novo o mesmo documento não cria segundo registro",
    !updateError && (updated as { id: string })?.id === customerId,
    { updateError: updateError?.message, updated },
  );
  eq(
    "nome sobrescrito (last-write-wins)",
    (updated as { name: string })?.name,
    "Padaria Bom Pão Ltda",
  );
  eq(
    "e-mail sobrescrito (last-write-wins)",
    (updated as { email: string })?.email,
    "financeiro@padaria.test",
  );

  const { data: addressPreserved } = await adminUser
    .from("customers")
    .select("address")
    .eq("id", customerId)
    .single();
  check(
    "endereço PRESERVADO quando a chamada não informa endereço (coalesce)",
    Boolean((addressPreserved as { address: { city: string } })?.address?.city === "São Paulo"),
    addressPreserved,
  );

  const { count: customerCount } = await adminUser
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("document", cnpj);
  eq("continua um único cliente com este documento", customerCount, 1);

  console.log("\n== upsert_customer recusa organização alheia ==");
  const { error: crossOrgUpsertError } = await intruder.rpc("upsert_customer", {
    p_org_id: orgId,
    p_document: buildTestCnpj(String(stamp + 1).slice(-12)),
    p_name: "Tentativa indevida",
    p_email: null,
    p_phone: null,
    p_address: null,
  });
  check(
    "recusa upsert_customer para organização que não é do usuário",
    Boolean(crossOrgUpsertError),
    crossOrgUpsertError?.message ?? "aceitou!",
  );

  console.log("\n== mesmo CNPJ em DUAS organizações são registros separados ==");
  // Dedupe é por (org_id, document) — o MESMO documento em outra organização
  // (aqui, `intruder` é dono legítimo de `otherOrgId`) não é a mesma linha.
  const { data: createdOther, error: createOtherError } = await intruder.rpc("upsert_customer", {
    p_org_id: otherOrgId,
    p_document: cnpj,
    p_name: "Padaria Bom Pão (outra organização)",
    p_email: "contato@outraorg.test",
    p_phone: "11977776666",
    p_address: null,
  });
  check(
    "outra organização também consegue cadastrar o mesmo documento",
    !createOtherError && Boolean(createdOther),
    createOtherError?.message,
  );
  const otherCustomerId = (createdOther as { id: string })?.id;
  check(
    "é um registro DIFERENTE do cliente da primeira organização (id distinto)",
    Boolean(otherCustomerId) && otherCustomerId !== customerId,
    { customerId, otherCustomerId },
  );

  const { count: firstOrgCountForDoc } = await adminUser
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("document", cnpj);
  const { count: otherOrgCountForDoc } = await intruder
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("org_id", otherOrgId)
    .eq("document", cnpj);
  eq(
    "primeira organização continua com exatamente 1 cliente deste documento",
    firstOrgCountForDoc,
    1,
  );
  eq("outra organização tem seu PRÓPRIO 1 cliente deste documento", otherOrgCountForDoc, 1);

  const { data: crossOrgVisibility } = await adminUser
    .from("customers")
    .select("id")
    .eq("id", otherCustomerId)
    .maybeSingle();
  check(
    "primeira organização não enxerga o cliente da outra organização (RLS)",
    crossOrgVisibility === null,
    crossOrgVisibility,
  );

  console.log("\n== múltiplos contatos por cliente ==");
  const { data: contact1, error: contact1Error } = await adminUser.rpc("upsert_customer_contact", {
    p_customer_id: customerId,
    p_name: "Maria Compras",
    p_email: "maria@padaria.test",
    p_phone: "11977770000",
  });
  check("cria o primeiro contato", !contact1Error && Boolean(contact1), contact1Error?.message);

  const { data: contact2, error: contact2Error } = await adminUser.rpc("upsert_customer_contact", {
    p_customer_id: customerId,
    p_name: "João Financeiro",
    p_email: "joao@padaria.test",
    p_phone: "11966660000",
  });
  check(
    "cria o segundo contato (pessoa diferente)",
    !contact2Error && Boolean(contact2),
    contact2Error?.message,
  );

  const { data: contact1Updated, error: contact1UpdateError } = await adminUser.rpc(
    "upsert_customer_contact",
    {
      p_customer_id: customerId,
      p_name: "Maria Compras Silva",
      p_email: "maria@padaria.test",
      p_phone: "11955550000",
    },
  );
  check(
    "mesmo e-mail ATUALIZA o contato existente, não duplica",
    !contact1UpdateError &&
      (contact1Updated as { id: string })?.id === (contact1 as { id: string })?.id,
    { contact1UpdateError: contact1UpdateError?.message, contact1Updated, contact1 },
  );
  eq(
    "nome do contato atualizado",
    (contact1Updated as { name: string })?.name,
    "Maria Compras Silva",
  );

  const { data: contactNoEmailA } = await adminUser.rpc("upsert_customer_contact", {
    p_customer_id: customerId,
    p_name: "Visitante Sem E-mail",
    p_email: null,
    p_phone: "11944440000",
  });
  const { data: contactNoEmailB } = await adminUser.rpc("upsert_customer_contact", {
    p_customer_id: customerId,
    p_name: "Visitante Sem E-mail",
    p_email: null,
    p_phone: "11944440000",
  });
  check(
    "contato sem e-mail nunca deduplica (duas linhas novas)",
    (contactNoEmailA as { id: string })?.id !== (contactNoEmailB as { id: string })?.id,
    { contactNoEmailA, contactNoEmailB },
  );

  const { data: allContacts } = await adminUser
    .from("customer_contacts")
    .select("id")
    .eq("customer_id", customerId);
  eq("total de contatos do cliente", allContacts?.length, 4);

  console.log("\n== upsert_public_customer também grava contato (Milestone 17) ==");
  const publicCnpj = buildTestCnpj(String(stamp + 2).slice(-12));
  const { data: publicCustomerId, error: publicCustomerError } = await admin.rpc(
    "upsert_public_customer",
    {
      p_org_id: orgId,
      p_document: publicCnpj,
      p_name: "Auto Peças Nova Era",
      p_email: "compras@novaera.test",
      p_phone: "11933330000",
      p_address: {
        zip: "02000-000",
        street: "Rua Dois",
        number: "20",
        complement: "",
        neighborhood: "Bairro",
        city: "São Paulo",
        state: "SP",
      },
      p_contact_name: "Carlos Comprador",
    },
  );
  check(
    "upsert_public_customer cria o cliente",
    !publicCustomerError && Boolean(publicCustomerId),
    publicCustomerError?.message,
  );

  const { data: publicContact } = await admin
    .from("customer_contacts")
    .select("name, email, phone")
    .eq("customer_id", publicCustomerId as string)
    .eq("email", "compras@novaera.test")
    .maybeSingle();
  check("contato do formulário público foi gravado", Boolean(publicContact), publicContact);
  eq(
    "nome do contato é o 'Responsável' da submissão, não a razão social",
    (publicContact as { name: string })?.name,
    "Carlos Comprador",
  );

  console.log("\n== isolamento entre organizações ==");
  const { data: leakedCustomer } = await intruder
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();
  check("outra organização não enxerga o cliente (RLS)", leakedCustomer === null, leakedCustomer);

  const { data: leakedContacts } = await intruder
    .from("customer_contacts")
    .select("id")
    .eq("customer_id", customerId);
  eq("outra organização não enxerga os contatos (RLS)", leakedContacts?.length, 0);

  const { error: crossOrgContactError } = await intruder.rpc("upsert_customer_contact", {
    p_customer_id: customerId,
    p_name: "Contato forjado",
    p_email: "forjado@intruso.test",
    p_phone: null,
  });
  check(
    "recusa upsert_customer_contact em cliente de outra organização",
    Boolean(crossOrgContactError),
    crossOrgContactError?.message ?? "aceitou!",
  );

  console.log("\n== membro da MESMA organização enxerga cliente e contatos (RLS + GRANT) ==");
  const { client: vendedor } = await signUpUser(`vendedor.${stamp}@metrapex.test`, "Vendedor Um");
  const { data: invite, error: inviteError } = await adminUser
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email: `vendedor.${stamp}@metrapex.test`,
      role: "vendedor",
      invited_by: (await adminUser.auth.getUser()).data.user!.id,
    })
    .select("token")
    .single();
  if (inviteError || !invite)
    throw new Error(`organization_invites insert: ${inviteError?.message}`);
  await vendedor.rpc("accept_invite", { invite_token: invite.token });

  const { data: visibleToVendedor, error: visibleError } = await vendedor
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();
  check(
    "vendedor da mesma organização enxerga o cliente sem 'permission denied'",
    !visibleError && Boolean(visibleToVendedor),
    visibleError?.message,
  );

  const { data: visibleContactsToVendedor, error: visibleContactsError } = await vendedor
    .from("customer_contacts")
    .select("id")
    .eq("customer_id", customerId);
  check(
    "vendedor da mesma organização enxerga os contatos (GRANT + RLS)",
    !visibleContactsError && (visibleContactsToVendedor?.length ?? 0) === 4,
    {
      visibleContactsError: visibleContactsError?.message,
      count: visibleContactsToVendedor?.length,
    },
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nerro fatal:", error);
  process.exit(1);
});
