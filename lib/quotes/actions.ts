"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";

import { getAuthUser, getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { calculateQuote, QuoteCalculationError, type QuoteCalculation } from "@/lib/quotes/engine";
import { getPaymentSetup, getTaxConfiguration } from "@/lib/quotes/queries";
import type { QuoteDiscount } from "@/lib/quotes/types";
import type {
  QuoteDraftItemPayload,
  QuoteIssueItemPayload,
  QuoteIssueSnapshotPayload,
} from "@/lib/supabase/types";

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

export type SaveQuoteInput = {
  customerId: string | null;
  customerName: string;
  customerDocument: string;
  customerSourceId: string | null;
  items: { productId: string; quantity: number }[];
  discount: QuoteDiscount;
  paymentConditionId: string | null;
  /** Preenchido só na criação de revisão — a versão anterior fica congelada. */
  previousRevisionId?: string | null;
};

const VALIDITY_DAYS = 30;

function expiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + VALIDITY_DAYS);
  return date.toISOString().slice(0, 10);
}

/**
 * Carrega catálogo e configuração da organização e recalcula o orçamento no
 * servidor. O cliente manda apenas `{ productId, quantity }` — preço, imposto,
 * desconto resolvido e total NUNCA vêm do client (CLAUDE.md: nenhuma escrita
 * a partir de input do cliente sem passar pela validação de backend).
 */
async function recalculate(
  orgId: string,
  input: Pick<SaveQuoteInput, "items" | "discount" | "paymentConditionId">,
): Promise<{ calculation: QuoteCalculation; footer: string | null; showTaxLines: boolean }> {
  const supabase = await createClient();
  const [products, categories, taxConfig, payment] = await Promise.all([
    supabase
      .from("products")
      .select("id, external_code, name, price, category_id, photo_url")
      .eq("org_id", orgId),
    supabase.from("product_categories").select("id, name").eq("org_id", orgId),
    getTaxConfiguration(orgId),
    getPaymentSetup(orgId),
  ]);

  const calculation = calculateQuote({
    items: input.items,
    products: (products.data ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_code,
      name: row.name,
      price: Number(row.price),
      categoryId: row.category_id,
      photoUrl: row.photo_url,
    })),
    categoryNamesById: new Map((categories.data ?? []).map((row) => [row.id, row.name])),
    taxTypes: taxConfig.taxTypes,
    overrides: taxConfig.overrides,
    discount: input.discount,
    paymentConditionId: input.paymentConditionId,
    paymentConditions: payment.conditions,
    paymentValueBands: payment.bands,
  });

  return {
    calculation,
    footer: taxConfig.documentFooter,
    showTaxLines: taxConfig.showTaxLines,
  };
}

/**
 * Cria o rascunho (ou a revisão nova). Grava só as ENTRADAS do documento —
 * produto, quantidade, desconto negociado e condição escolhida. Preço e
 * imposto ficam nulos até a emissão, porque rascunho recalcula a cada abertura
 * (§11.3). O recálculo aqui existe para validar: produto fora do catálogo,
 * quantidade inválida ou condição de pagamento bloqueada pela faixa de valor
 * são recusados antes de qualquer escrita.
 */
export async function saveQuoteAction(input: SaveQuoteInput): Promise<{ id: string }> {
  const org = await requireOrg();
  const user = await getAuthUser();

  if (!input.customerName.trim()) throw new Error("Selecione um cliente para o orçamento.");
  if (input.items.length === 0) throw new Error("Adicione ao menos um produto ao orçamento.");

  let calculation: QuoteCalculation;
  try {
    ({ calculation } = await recalculate(org.id, input));
  } catch (error) {
    if (error instanceof QuoteCalculationError) throw new Error(error.message);
    throw error;
  }

  if (input.paymentConditionId && !calculation.paymentConditionAllowed) {
    throw new Error(
      calculation.band
        ? `A condição de pagamento escolhida não é liberada para a faixa "${calculation.band.label}".`
        : "Condição de pagamento inválida.",
    );
  }

  const items: QuoteDraftItemPayload[] = calculation.items.map((item) => ({
    product_id: item.productId,
    product_external_code: item.productExternalCode,
    product_name: item.productName,
    category_id_snapshot: item.categoryId,
    category_name: item.categoryName,
    quantity: item.quantity.toFixed(6),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_quote_draft", {
    p_org_id: org.id,
    p_quote: {
      status: "gerado",
      owner_id: user?.id ?? null,
      customer_id: input.customerId,
      customer_name: input.customerName.trim(),
      customer_document: input.customerDocument,
      customer_source_id: input.customerSourceId,
      discount_type: input.discount.type,
      discount_value: new Decimal(input.discount.value).toFixed(6),
      payment_condition_id: input.paymentConditionId,
      expires_at: expiryDate(),
    },
    p_items: items,
    p_previous_revision_id: input.previousRevisionId ?? null,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível salvar o orçamento.");
  }

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { id: data.id };
}

/**
 * Emite o documento: recalcula uma última vez com a configuração vigente,
 * grava o snapshot completo (preço, imposto por linha, condição de pagamento,
 * rodapé) e congela em `tax_snapshot_at`. Depois disto o documento é
 * imutável — as triggers do banco recusam qualquer reescrita, e alterar
 * qualquer coisa exige uma revisão nova.
 */
export async function issueQuoteAction(quoteId: string): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("org_id", org.id)
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) throw new Error("Orçamento não encontrado.");
  if (quote.tax_snapshot_at) throw new Error("Este orçamento já foi emitido.");

  const { data: itemRows } = await supabase
    .from("quote_items")
    .select("position, product_id, quantity")
    .eq("quote_id", quoteId)
    .order("position");

  if (!itemRows || itemRows.length === 0) {
    throw new Error("Orçamento sem itens não pode ser emitido.");
  }

  let result: Awaited<ReturnType<typeof recalculate>>;
  try {
    result = await recalculate(org.id, {
      items: itemRows.map((row) => ({
        productId: row.product_id ?? "",
        quantity: Number(row.quantity),
      })),
      discount: { type: quote.discount_type, value: Number(quote.discount_value) },
      paymentConditionId: quote.payment_condition_id,
    });
  } catch (error) {
    if (error instanceof QuoteCalculationError) throw new Error(error.message);
    throw error;
  }

  const { calculation, footer, showTaxLines } = result;

  /**
   * Mesma checagem de `saveQuoteAction`: se a faixa de valor mudou entre o
   * salvamento do rascunho e a emissão (admin editou faixas/condições), a
   * condição escolhida pode ter deixado de ser permitida. Recusar aqui evita
   * congelar em silêncio um total diferente do que o vendedor viu por último
   * — achado da revisão do Milestone 14: sem este guard, `issue_quote` gravava
   * `payment_condition_label = null` e descartava o desconto sem avisar.
   */
  if (quote.payment_condition_id && !calculation.paymentConditionAllowed) {
    throw new Error(
      calculation.band
        ? `A condição de pagamento deste orçamento não é mais liberada para a faixa "${calculation.band.label}" — reabra o rascunho e escolha outra condição antes de emitir.`
        : "Condição de pagamento inválida — reabra o rascunho e escolha outra antes de emitir.",
    );
  }

  const condition = calculation.paymentConditionAllowed ? calculation.paymentCondition : null;

  const items: QuoteIssueItemPayload[] = calculation.items.map((item) => ({
    position: item.position,
    unit_price_charged: item.unitPriceCharged.toFixed(6),
    unit_base_display: item.unitBaseDisplay.toFixed(6),
    line_total: item.lineTotal.toFixed(6),
    taxes: item.taxes.map((tax) => ({
      tax_type_id: tax.taxTypeId,
      tax_code: tax.taxCode,
      tax_label: tax.taxLabel,
      mode: tax.mode,
      rate_applied: new Decimal(tax.rateApplied).toFixed(4),
      rate_source: tax.rateSource,
      note: tax.note,
      base_amount: tax.baseAmount.toFixed(6),
      tax_amount: tax.taxAmount.toFixed(6),
      display_order: tax.displayOrder,
    })),
  }));

  // Cópia literal da configuração vigente. A partir daqui o documento não lê
  // mais nem `tax_settings` nem `payment_conditions`.
  const snapshot: QuoteIssueSnapshotPayload = {
    subtotal: calculation.subtotal.toFixed(6),
    total: calculation.total.toFixed(6),
    discount_amount: calculation.discountAmount.toFixed(6),
    payment_discount_amount: calculation.paymentDiscountAmount.toFixed(6),
    payment_condition_label: condition?.label ?? null,
    payment_condition_kind: condition?.kind ?? null,
    payment_condition_discount_percent: condition
      ? new Decimal(condition.discountPercent).toFixed(4)
      : null,
    payment_condition_installments: condition?.installments ?? null,
    payment_condition_term_days: condition?.termDays ?? null,
    payment_band_label: calculation.band?.label ?? null,
    tax_footer_note: footer,
    show_tax_lines: showTaxLines,
  };

  const { error } = await supabase.rpc("issue_quote", {
    p_quote_id: quoteId,
    p_items: items,
    p_snapshot: snapshot,
  });

  if (error) throw new Error(error.message ?? "Não foi possível emitir o orçamento.");

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${quoteId}`);
  revalidatePath("/dashboard");
}
