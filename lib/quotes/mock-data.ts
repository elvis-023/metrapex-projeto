import { fakeProducts } from "@/lib/catalog/mock-data";
import type { Product } from "@/lib/catalog/types";
import { paymentConditionOptions } from "@/lib/onboarding/mock-data";
import { fakePipelineQuotes } from "@/lib/pipeline/mock-data";
import {
  calcMockTax,
  resolveMockRate,
  type MockTaxRateOverride,
  type MockTaxType,
} from "@/lib/quotes/tax-engine";
import type { QuoteDiscount, QuoteItemTax, QuoteLineItem } from "@/lib/quotes/types";

export { paymentConditionOptions };

/**
 * Cenário "ICMS + IPI padrão" do briefing §6 — a organização de exemplo
 * (Metrapex Distribuidora) é uma revenda no Lucro Presumido. É o cenário
 * mais rico para validar a forma da tela: os dois modos de cálculo lado a
 * lado e a hierarquia produto > categoria > padrão. Configuração real por
 * organização entra no Milestone 12.
 */
export const fakeTaxTypes: MockTaxType[] = [
  { id: "tax_icms", code: "ICMS", label: "ICMS", mode: "exclusive", defaultRate: 18 },
  { id: "tax_ipi", code: "IPI", label: "IPI", mode: "inclusive", defaultRate: 0 },
];

export const fakeTaxRateOverrides: MockTaxRateOverride[] = [
  { taxTypeId: "tax_ipi", categoryId: "cat_ferramentas", productId: null, rate: 5, note: null },
  {
    taxTypeId: "tax_icms",
    categoryId: null,
    productId: "prd_4",
    rate: 0,
    note: "ICMS-ST recolhido pelo fabricante",
  },
];

/** Só imprime a linha do tributo se ele realmente incidir ou for um override explícito — briefing §7.3, ponto 2. */
function shouldDisplayTax(rate: number, source: string): boolean {
  return rate > 0 || source === "product";
}

export function buildLineItem(product: Product, quantity: number): QuoteLineItem {
  const catalogLineTotal = product.price * quantity;

  const taxes: QuoteItemTax[] = fakeTaxTypes.flatMap((taxType) => {
    const resolved = resolveMockRate(taxType, product.id, product.categoryId, fakeTaxRateOverrides);
    if (!shouldDisplayTax(resolved.rate, resolved.source)) return [];

    const { base, tax } = calcMockTax(catalogLineTotal, resolved.rate, taxType.mode);
    return [
      {
        taxTypeId: taxType.id,
        code: taxType.code,
        label: taxType.label,
        mode: taxType.mode,
        rate: resolved.rate,
        source: resolved.source,
        note: resolved.note,
        base,
        amount: tax,
      },
    ];
  });

  const exclusiveAddOn = taxes
    .filter((tax) => tax.mode === "exclusive")
    .reduce((sum, tax) => sum + tax.amount, 0);

  return {
    productId: product.id,
    externalCode: product.externalCode,
    name: product.name,
    photoUrl: product.photoUrl,
    unitPrice: product.price,
    quantity,
    catalogLineTotal,
    taxes,
    lineTotal: catalogLineTotal + exclusiveAddOn,
  };
}

export function nextQuoteNumber(existingQuotes: { number: string }[]): string {
  const highest = Math.max(
    0,
    ...existingQuotes.map((quote) => Number(quote.number.replace("ORC-", ""))),
  );
  return `ORC-${String(highest + 1).padStart(4, "0")}`;
}

/**
 * Base para desconto e total: subtotal (soma das bases dos itens, já com
 * imposto embutido quando `inclusive`) + impostos "por fora" (`exclusive`),
 * que somam por cima. Usado por `resolveDiscountAmount`/`computeQuoteTotal`
 * e pelas telas de revisão e prévia do PDF, para as três nunca divergirem.
 */
export function computeQuoteSubtotals(items: QuoteLineItem[]): {
  subtotal: number;
  exclusiveAddOn: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.catalogLineTotal, 0);
  const exclusiveAddOn = items.reduce(
    (sum, item) =>
      sum + item.taxes.filter((tax) => tax.mode === "exclusive").reduce((s, t) => s + t.amount, 0),
    0,
  );
  return { subtotal, exclusiveAddOn };
}

/** Resolve o desconto (percentual ou fixo) para R$, limitado a [0, valor antes do desconto]. */
export function resolveDiscountAmount(items: QuoteLineItem[], discount: QuoteDiscount): number {
  const { subtotal, exclusiveAddOn } = computeQuoteSubtotals(items);
  const base = subtotal + exclusiveAddOn;
  const raw = discount.type === "percent" ? base * (discount.value / 100) : discount.value;
  return Math.min(base, Math.max(0, raw));
}

export function computeQuoteTotal(items: QuoteLineItem[], discount: QuoteDiscount): number {
  const { subtotal, exclusiveAddOn } = computeQuoteSubtotals(items);
  return Math.max(0, subtotal + exclusiveAddOn - resolveDiscountAmount(items, discount));
}

/**
 * Semente determinística para a tela de nova revisão — ainda não existe
 * persistência de item por orçamento (isso é Milestone 14), então a
 * revisão parte de itens plausíveis do catálogo recalculados com a
 * configuração de imposto atual, em vez de herdar o snapshot antigo —
 * recomendação do briefing §11, pergunta 4.
 */
export function seedRevisionItems(quoteId: string): QuoteLineItem[] {
  const index = Math.max(
    0,
    fakePipelineQuotes.findIndex((quote) => quote.id === quoteId),
  );
  const first = fakeProducts[index % fakeProducts.length];
  const second = fakeProducts[(index + 3) % fakeProducts.length];
  return [buildLineItem(first, 2), buildLineItem(second, 1)];
}
