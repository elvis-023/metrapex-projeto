import Decimal from "decimal.js";

import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  calculateQuote,
  formatQuoteNumber,
  round2,
  type PaymentCondition,
  type PaymentValueBand,
  type QuoteBuilderData,
} from "@/lib/quotes/engine";
import { toQuoteView } from "@/lib/quotes/view-model";
import type { QuoteDocument, QuoteLineItem, QuoteView } from "@/lib/quotes/types";
import type { TaxRateOverride, TaxType } from "@/lib/tax-engine/types";
import type { Database } from "@/lib/supabase/types";

export type TaxConfiguration = {
  taxTypes: TaxType[];
  overrides: TaxRateOverride[];
  documentFooter: string | null;
  showTaxLines: boolean;
};

export type PaymentSetup = {
  conditions: PaymentCondition[];
  bands: PaymentValueBand[];
};

/** Configuração fiscal VIVA da organização — só para rascunho e emissão nova. */
export async function getTaxConfiguration(orgId: string): Promise<TaxConfiguration> {
  const supabase = await createClient();

  const [taxTypes, settings] = await Promise.all([
    supabase
      .from("tax_types")
      .select("id, code, label, mode, default_rate, active, display_order")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("display_order"),
    supabase
      .from("tax_settings")
      .select("document_footer, show_tax_lines")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  const types = (taxTypes.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    mode: row.mode,
    defaultRate: Number(row.default_rate),
    active: row.active,
    displayOrder: row.display_order,
  }));

  // Organização sem nenhum tributo é caso normal (MEI/Simples sem destaque):
  // sem tributo não existe override para buscar, e a consulta é evitada.
  let overrides: TaxRateOverride[] = [];
  if (types.length > 0) {
    const { data } = await supabase
      .from("tax_rates")
      .select("tax_type_id, category_id, product_id, rate, note")
      .in(
        "tax_type_id",
        types.map((type) => type.id),
      );

    overrides = (data ?? []).map((row) => ({
      taxTypeId: row.tax_type_id,
      categoryId: row.category_id,
      productId: row.product_id,
      rate: Number(row.rate),
      note: row.note,
    }));
  }

  return {
    taxTypes: types,
    overrides,
    documentFooter: settings.data?.document_footer ?? null,
    showTaxLines: settings.data?.show_tax_lines ?? true,
  };
}

export async function getPaymentSetup(orgId: string): Promise<PaymentSetup> {
  const supabase = await createClient();

  const [conditions, bands] = await Promise.all([
    supabase
      .from("payment_conditions")
      .select("id, label, kind, discount_percent, installments, term_days, active")
      .eq("org_id", orgId)
      .order("display_order"),
    supabase
      .from("payment_value_bands")
      .select("id, label, min_value, max_value, payment_band_conditions(payment_condition_id)")
      .eq("org_id", orgId)
      .order("min_value")
      .returns<
        {
          id: string;
          label: string;
          min_value: number;
          max_value: number | null;
          payment_band_conditions: { payment_condition_id: string }[];
        }[]
      >(),
  ]);

  return {
    conditions: (conditions.data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      discountPercent: Number(row.discount_percent),
      installments: row.installments,
      termDays: row.term_days,
      active: row.active,
    })),
    bands: (bands.data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      minValue: Number(row.min_value),
      maxValue: row.max_value === null ? null : Number(row.max_value),
      paymentConditionIds: row.payment_band_conditions.map((link) => link.payment_condition_id),
    })),
  };
}

/**
 * Tudo que o construtor de orçamento precisa para recalcular ao vivo no
 * cliente. O mesmo `calculateQuote` roda depois no servidor ao salvar, sobre
 * `{ productId, quantity }` — nenhum preço, imposto ou total vindo do cliente
 * é gravado (CLAUDE.md: nunca confie em input do client).
 *
 * `categoryNames` viaja como array de pares porque `Map` não é serializável
 * na fronteira Server → Client Component.
 */
export async function getQuoteBuilderData(): Promise<QuoteBuilderData | null> {
  const org = await getCurrentOrganization();
  if (!org) return null;

  const supabase = await createClient();
  const [products, categories, taxConfig, payment] = await Promise.all([
    supabase
      .from("products")
      .select("id, external_code, name, price, category_id, photo_url")
      .eq("org_id", org.id)
      .order("name"),
    supabase.from("product_categories").select("id, name").eq("org_id", org.id),
    getTaxConfiguration(org.id),
    getPaymentSetup(org.id),
  ]);

  return {
    products: (products.data ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_code,
      name: row.name,
      price: Number(row.price),
      categoryId: row.category_id,
      photoUrl: row.photo_url,
    })),
    categoryNames: (categories.data ?? []).map((row) => [row.id, row.name] as [string, string]),
    taxTypes: taxConfig.taxTypes,
    overrides: taxConfig.overrides,
    paymentConditions: payment.conditions,
    paymentValueBands: payment.bands,
    documentFooter: taxConfig.documentFooter,
    showTaxLines: taxConfig.showTaxLines,
  };
}

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteItemRow = Database["public"]["Tables"]["quote_items"]["Row"];
type QuoteItemTaxRow = Database["public"]["Tables"]["quote_item_taxes"]["Row"];

/**
 * Monta a visão de um documento EMITIDO a partir do snapshot congelado.
 *
 * Nenhum acesso a `tax_types`, `tax_rates`, `tax_settings`,
 * `payment_conditions` ou `products` acontece aqui — se essas tabelas fossem
 * apagadas, esta função continuaria devolvendo exatamente o mesmo documento
 * (briefing §3, skill `snapshot-documento`). `subtotal`/`total` vêm congelados
 * da emissão; os totais por tributo são agregados a partir das linhas do
 * snapshot, que também já estão congeladas (§11.7).
 */
function issuedQuoteView(
  quote: QuoteRow,
  items: (QuoteItemRow & { quote_item_taxes: QuoteItemTaxRow[] })[],
): QuoteView {
  const lineItems: QuoteLineItem[] = items.map((item) => ({
    position: item.position,
    productId: item.product_id ?? "",
    externalCode: item.product_external_code,
    name: item.product_name,
    photoUrl: null,
    unitPrice: round2(new Decimal(item.unit_price_charged ?? 0)).toNumber(),
    unitBaseDisplay: round2(new Decimal(item.unit_base_display ?? 0)).toNumber(),
    quantity: Number(item.quantity),
    lineTotal: round2(new Decimal(item.line_total ?? 0)).toNumber(),
    taxes: [...item.quote_item_taxes]
      .sort((a, b) => a.display_order - b.display_order)
      .map((tax) => ({
        taxTypeId: tax.tax_type_id ?? "",
        code: tax.tax_code,
        label: tax.tax_label,
        mode: tax.mode,
        rate: Number(tax.rate_applied),
        source: tax.rate_source,
        note: tax.note,
        base: round2(new Decimal(tax.base_amount)).toNumber(),
        amount: round2(new Decimal(tax.tax_amount)).toNumber(),
      })),
  }));

  let exclusive = new Decimal(0);
  let inclusive = new Decimal(0);
  const byCode = new Map<
    string,
    { label: string; mode: QuoteItemTaxRow["mode"]; amount: Decimal }
  >();

  for (const item of items) {
    for (const tax of item.quote_item_taxes) {
      const amount = new Decimal(tax.tax_amount);
      if (tax.mode === "exclusive") exclusive = exclusive.plus(amount);
      else inclusive = inclusive.plus(amount);

      const existing = byCode.get(tax.tax_code);
      if (existing) existing.amount = existing.amount.plus(amount);
      else byCode.set(tax.tax_code, { label: tax.tax_label, mode: tax.mode, amount });
    }
  }

  return {
    items: lineItems,
    subtotal: round2(new Decimal(quote.subtotal ?? 0)).toNumber(),
    exclusiveTaxTotal: round2(exclusive).toNumber(),
    inclusiveTaxTotal: round2(inclusive).toNumber(),
    taxTotals: [...byCode.entries()].map(([code, value]) => ({
      code,
      label: value.label,
      mode: value.mode,
      amount: round2(value.amount).toNumber(),
    })),
    discountAmount: round2(new Decimal(quote.discount_amount ?? 0)).toNumber(),
    paymentDiscountAmount: round2(new Decimal(quote.payment_discount_amount ?? 0)).toNumber(),
    total: round2(new Decimal(quote.total ?? 0)).toNumber(),
    bandLabel: quote.payment_band_label,
    paymentConditionAllowed: true,
  };
}

/**
 * Campos de apresentação que existem como coluna congelada no banco, mas que
 * para um RASCUNHO precisam vir do cálculo/configuração ao vivo — as colunas
 * ficam nulas (ou no default da coluna) até `issue_quote` gravá-las, então
 * lê-las direto do rascunho mostraria "condição de pagamento não definida" e
 * nenhum rodapé mesmo com a organização configurada (achado da revisão do
 * Milestone 14).
 */
type PresentationFields = {
  paymentConditionLabel: string | null;
  paymentConditionInstallments: number | null;
  paymentConditionTermDays: number | null;
  paymentBandLabel: string | null;
  taxFooterNote: string | null;
  showTaxLines: boolean;
};

function toQuoteDocument(
  quote: QuoteRow,
  view: QuoteView,
  presentation: PresentationFields,
): QuoteDocument {
  return {
    id: quote.id,
    number: formatQuoteNumber(quote.sequence),
    sequence: quote.sequence,
    revision: quote.revision,
    previousRevisionId: quote.previous_revision_id,
    supersededByRevisionId: quote.superseded_by_revision_id,
    status: quote.status,
    ownerId: quote.owner_id,
    customerId: quote.customer_id,
    customerName: quote.customer_name,
    customerDocument: quote.customer_document,
    customerSourceId: quote.customer_source_id,
    discount: { type: quote.discount_type, value: Number(quote.discount_value) },
    paymentConditionId: quote.payment_condition_id,
    paymentConditionLabel: presentation.paymentConditionLabel,
    paymentConditionInstallments: presentation.paymentConditionInstallments,
    paymentConditionTermDays: presentation.paymentConditionTermDays,
    paymentBandLabel: presentation.paymentBandLabel,
    issuedAt: quote.tax_snapshot_at,
    taxFooterNote: presentation.taxFooterNote,
    showTaxLines: presentation.showTaxLines,
    expiresAt: quote.expires_at,
    createdAt: quote.created_at,
    view,
  };
}

export async function getQuoteById(id: string): Promise<QuoteDocument | null> {
  const org = await getCurrentOrganization();
  if (!org) return null;

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("org_id", org.id)
    .eq("id", id)
    .maybeSingle();

  if (!quote) return null;

  // `left join` de quote_items para quote_item_taxes: item sem nenhum tributo
  // é caso normal e precisa aparecer no documento (skill `snapshot-documento`).
  const { data: items } = await supabase
    .from("quote_items")
    .select("*, quote_item_taxes(*)")
    .eq("quote_id", id)
    .order("position")
    .returns<(QuoteItemRow & { quote_item_taxes: QuoteItemTaxRow[] })[]>();

  const rows = items ?? [];

  if (quote.tax_snapshot_at) {
    return toQuoteDocument(quote, issuedQuoteView(quote, rows), {
      paymentConditionLabel: quote.payment_condition_label,
      paymentConditionInstallments: quote.payment_condition_installments,
      paymentConditionTermDays: quote.payment_condition_term_days,
      paymentBandLabel: quote.payment_band_label,
      taxFooterNote: quote.tax_footer_note,
      showTaxLines: quote.show_tax_lines,
    });
  }

  // Rascunho: recalcula com a configuração VIGENTE (§11.3, decidido em
  // 2026-07-26). É por isso que o rascunho não guarda preço nem imposto — e
  // pela mesma razão a condição de pagamento, a faixa, o rodapé e o flag de
  // destaque exibidos também não podem vir das colunas de snapshot (ficam
  // nulas/no default até `issue_quote`): vêm da configuração ao vivo.
  const builderData = await getQuoteBuilderData();
  if (!builderData) return null;

  const calculation = calculateQuote({
    items: rows.map((row) => ({ productId: row.product_id ?? "", quantity: row.quantity })),
    products: builderData.products,
    categoryNamesById: new Map(builderData.categoryNames),
    taxTypes: builderData.taxTypes,
    overrides: builderData.overrides,
    discount: { type: quote.discount_type, value: quote.discount_value },
    paymentConditionId: quote.payment_condition_id,
    paymentConditions: builderData.paymentConditions,
    paymentValueBands: builderData.paymentValueBands,
  });

  const condition = calculation.paymentConditionAllowed ? calculation.paymentCondition : null;

  return toQuoteDocument(quote, toQuoteView(calculation), {
    paymentConditionLabel: condition?.label ?? null,
    paymentConditionInstallments: condition?.installments ?? null,
    paymentConditionTermDays: condition?.termDays ?? null,
    paymentBandLabel: calculation.band?.label ?? null,
    taxFooterNote: builderData.documentFooter,
    showTaxLines: builderData.showTaxLines,
  });
}

export type QuoteListEntry = {
  id: string;
  number: string;
  revision: number;
  previousRevisionId: string | null;
  supersededByRevisionId: string | null;
  status: QuoteRow["status"];
  ownerId: string | null;
  ownerName: string | null;
  customerName: string;
  customerSourceId: string | null;
  total: number;
  expiresAt: string | null;
  issuedAt: string | null;
};

export type DraftQuoteInput = Pick<
  QuoteRow,
  "id" | "discount_type" | "discount_value" | "payment_condition_id"
>;

/**
 * Recalcula o total de rascunhos (`total` nulo no banco, §11.3) sobre a
 * configuração fiscal e o catálogo VIGENTES. `builderData` é responsabilidade
 * do CHAMADOR — busca-lo aqui dentro faria o board (`getQuotes`) e o
 * dashboard (Milestone 19) repetirem a mesma leitura de catálogo/impostos/
 * pagamento uma vez por chamada; o chamador busca uma vez só, condicionado a
 * `drafts.length > 0`, e reaproveita entre todos os rascunhos da página.
 */
export async function resolveDraftTotals(
  drafts: DraftQuoteInput[],
  builderData: QuoteBuilderData,
): Promise<Map<string, number>> {
  const draftTotals = new Map<string, number>();
  if (drafts.length === 0) return draftTotals;

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("quote_items")
    .select("quote_id, product_id, quantity")
    .in(
      "quote_id",
      drafts.map((draft) => draft.id),
    );

  const itemsByQuote = new Map<string, { productId: string; quantity: number }[]>();
  for (const item of items ?? []) {
    const list = itemsByQuote.get(item.quote_id) ?? [];
    list.push({ productId: item.product_id ?? "", quantity: Number(item.quantity) });
    itemsByQuote.set(item.quote_id, list);
  }

  for (const draft of drafts) {
    try {
      const calculation = calculateQuote({
        items: itemsByQuote.get(draft.id) ?? [],
        products: builderData.products,
        categoryNamesById: new Map(builderData.categoryNames),
        taxTypes: builderData.taxTypes,
        overrides: builderData.overrides,
        discount: { type: draft.discount_type, value: draft.discount_value },
        paymentConditionId: draft.payment_condition_id,
        paymentConditions: builderData.paymentConditions,
        paymentValueBands: builderData.paymentValueBands,
      });
      draftTotals.set(draft.id, round2(calculation.total).toNumber());
    } catch {
      // Produto removido do catálogo depois do rascunho: o card aparece
      // com 0 em vez de derrubar o board inteiro. O erro real reaparece,
      // com mensagem, quando o vendedor abrir o orçamento para emitir.
      draftTotals.set(draft.id, 0);
    }
  }

  return draftTotals;
}

/**
 * Orçamentos da organização para o board e o dashboard. Rascunho tem
 * `total` nulo no banco (o valor não está congelado), então é recalculado em
 * bloco aqui: a configuração fiscal e o catálogo são carregados UMA vez e
 * reaproveitados para todos os rascunhos, em vez de uma consulta por card.
 */
export async function getQuotes(): Promise<QuoteListEntry[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .eq("org_id", org.id)
    .order("sequence", { ascending: false })
    .order("revision", { ascending: false });

  if (!quotes || quotes.length === 0) return [];

  const ownerIds = [...new Set(quotes.map((quote) => quote.owner_id).filter(Boolean))] as string[];
  const ownerNames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const profile of profiles ?? []) ownerNames.set(profile.id, profile.full_name);
  }

  const drafts = quotes.filter((quote) => quote.tax_snapshot_at === null);
  let draftTotals = new Map<string, number>();
  if (drafts.length > 0) {
    const builderData = await getQuoteBuilderData();
    if (builderData) draftTotals = await resolveDraftTotals(drafts, builderData);
  }

  return quotes.map((quote) => ({
    id: quote.id,
    number: formatQuoteNumber(quote.sequence),
    revision: quote.revision,
    previousRevisionId: quote.previous_revision_id,
    supersededByRevisionId: quote.superseded_by_revision_id,
    status: quote.status,
    ownerId: quote.owner_id,
    ownerName: quote.owner_id ? (ownerNames.get(quote.owner_id) ?? null) : null,
    customerName: quote.customer_name,
    customerSourceId: quote.customer_source_id,
    total:
      quote.total === null
        ? (draftTotals.get(quote.id) ?? 0)
        : round2(new Decimal(quote.total)).toNumber(),
    expiresAt: quote.expires_at,
    issuedAt: quote.tax_snapshot_at,
  }));
}
