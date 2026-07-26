import Decimal from "decimal.js";

import { calcItemTaxes, round2, type TaxLineResult } from "@/lib/tax-engine/calc-tax";
import type { TaxType, TaxRateOverride } from "@/lib/tax-engine/types";
import type { PaymentConditionKind, QuoteDiscountType, TaxMode } from "@/lib/supabase/types";

/**
 * Motor de orçamento (Milestone 14). Função pura: recebe o catálogo e a
 * configuração já carregados e devolve o documento calculado. Não toca no
 * banco, não conhece sessão — é o que permite testar cada regra isolada e
 * garante que rascunho, emissão, prévia do PDF e formulário público derivem
 * exatamente do mesmo cálculo.
 *
 * O cálculo de imposto em si NÃO é reimplementado aqui: `calcItemTaxes` do
 * motor de impostos (Milestone 12) é a única fórmula do sistema.
 */

export type CatalogProduct = {
  id: string;
  externalCode: string;
  name: string;
  price: Decimal.Value;
  categoryId: string | null;
  photoUrl: string | null;
};

export type PaymentCondition = {
  id: string;
  label: string;
  kind: PaymentConditionKind;
  discountPercent: Decimal.Value;
  installments: number;
  termDays: number;
  active: boolean;
};

export type PaymentValueBand = {
  id: string;
  label: string;
  minValue: Decimal.Value;
  maxValue: Decimal.Value | null;
  paymentConditionIds: string[];
};

/**
 * Tudo que o construtor de orçamento precisa para recalcular ao vivo. Vive
 * neste módulo (puro, sem acesso a banco ou sessão) porque atravessa a
 * fronteira Server → Client Component — `categoryNames` é array de pares e
 * não `Map` pelo mesmo motivo: `Map` não é serializável nessa fronteira.
 */
export type QuoteBuilderData = {
  products: CatalogProduct[];
  categoryNames: [string, string][];
  taxTypes: TaxType[];
  overrides: TaxRateOverride[];
  paymentConditions: PaymentCondition[];
  paymentValueBands: PaymentValueBand[];
  documentFooter: string | null;
  showTaxLines: boolean;
};

export type QuoteItemInput = { productId: string; quantity: Decimal.Value };
export type QuoteDiscountInput = { type: QuoteDiscountType; value: Decimal.Value };

export type CalculatedQuoteItem = {
  position: number;
  productId: string;
  productExternalCode: string;
  productName: string;
  photoUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  quantity: Decimal;
  /** Preço de catálogo aplicado, antes de imposto. */
  unitPriceCharged: Decimal;
  /** Unitário mostrado ao cliente — a base, quando há tributo `inclusive`. */
  unitBaseDisplay: Decimal;
  /** Valor da linha: preço × quantidade + tributos `exclusive`. */
  lineTotal: Decimal;
  taxes: TaxLineResult[];
};

export type QuoteTaxTotal = { code: string; label: string; mode: TaxMode; amount: Decimal };

export type QuoteCalculation = {
  items: CalculatedQuoteItem[];
  /** Soma dos preços de catálogo das linhas (com imposto já dentro, se `inclusive`). */
  subtotal: Decimal;
  /** Tributos "por fora" — os únicos que somam ao total a pagar. */
  exclusiveTaxTotal: Decimal;
  /** Tributos embutidos, informativos: já estão dentro do subtotal. */
  inclusiveTaxTotal: Decimal;
  taxTotals: QuoteTaxTotal[];
  discountAmount: Decimal;
  /** Valor sobre o qual a faixa é resolvida: subtotal + "por fora" − desconto negociado. */
  bandBaseAmount: Decimal;
  band: PaymentValueBand | null;
  paymentCondition: PaymentCondition | null;
  /** false quando a condição escolhida não é liberada pela faixa do valor. */
  paymentConditionAllowed: boolean;
  paymentDiscountAmount: Decimal;
  total: Decimal;
};

export class QuoteCalculationError extends Error {}

/**
 * Faixa aplicável ao valor do orçamento. Ordena por `minValue` decrescente e
 * pega a primeira que cabe — determinístico mesmo se o admin configurar faixas
 * que se sobrepõem. `maxValue` é exclusivo: R$ 5.000,00 exatos caem na faixa
 * "acima de 5.000", não na "até 5.000".
 */
export function resolveValueBand(
  bands: PaymentValueBand[],
  amount: Decimal,
): PaymentValueBand | null {
  return (
    [...bands]
      .sort((a, b) => new Decimal(b.minValue).comparedTo(new Decimal(a.minValue)))
      .find(
        (band) =>
          amount.greaterThanOrEqualTo(band.minValue) &&
          (band.maxValue === null || amount.lessThan(band.maxValue)),
      ) ?? null
  );
}

/** Desconto negociado resolvido para R$, limitado a [0, valor antes do desconto]. */
export function resolveDiscountAmount(base: Decimal, discount: QuoteDiscountInput): Decimal {
  const raw =
    discount.type === "percent"
      ? base.times(new Decimal(discount.value).div(100))
      : new Decimal(discount.value);
  return Decimal.max(0, Decimal.min(base, raw)).toDecimalPlaces(6);
}

export function calculateQuote(params: {
  items: QuoteItemInput[];
  products: CatalogProduct[];
  categoryNamesById: Map<string, string>;
  taxTypes: TaxType[];
  overrides: TaxRateOverride[];
  discount: QuoteDiscountInput;
  paymentConditionId: string | null;
  paymentConditions: PaymentCondition[];
  paymentValueBands: PaymentValueBand[];
}): QuoteCalculation {
  const productById = new Map(params.products.map((product) => [product.id, product]));

  const items: CalculatedQuoteItem[] = params.items.map((input, index) => {
    const product = productById.get(input.productId);
    if (!product) {
      throw new QuoteCalculationError(
        "Um dos produtos do orçamento não está mais no catálogo desta organização.",
      );
    }

    const quantity = new Decimal(input.quantity);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new QuoteCalculationError(`Quantidade inválida para ${product.name}.`);
    }

    const calculated = calcItemTaxes({
      product: { id: product.id, categoryId: product.categoryId },
      unitPrice: product.price,
      quantity,
      taxTypes: params.taxTypes,
      overrides: params.overrides,
    });

    return {
      position: index + 1,
      productId: product.id,
      productExternalCode: product.externalCode,
      productName: product.name,
      photoUrl: product.photoUrl,
      categoryId: product.categoryId,
      categoryName: product.categoryId
        ? (params.categoryNamesById.get(product.categoryId) ?? null)
        : null,
      quantity,
      unitPriceCharged: calculated.unitPriceCharged,
      unitBaseDisplay: calculated.unitBaseDisplay,
      lineTotal: calculated.lineTotal,
      taxes: calculated.taxes,
    };
  });

  // Somas em 6 casas; arredondamento só na renderização (briefing §5).
  let subtotal = new Decimal(0);
  let exclusiveTaxTotal = new Decimal(0);
  let inclusiveTaxTotal = new Decimal(0);
  const totalsByCode = new Map<string, QuoteTaxTotal>();

  for (const item of items) {
    subtotal = subtotal.plus(item.unitPriceCharged.times(item.quantity));
    for (const tax of item.taxes) {
      if (tax.mode === "exclusive") {
        exclusiveTaxTotal = exclusiveTaxTotal.plus(tax.taxAmount);
      } else {
        inclusiveTaxTotal = inclusiveTaxTotal.plus(tax.taxAmount);
      }
      const existing = totalsByCode.get(tax.taxCode);
      if (existing) {
        existing.amount = existing.amount.plus(tax.taxAmount);
      } else {
        totalsByCode.set(tax.taxCode, {
          code: tax.taxCode,
          label: tax.taxLabel,
          mode: tax.mode,
          amount: tax.taxAmount,
        });
      }
    }
  }

  const beforeDiscount = subtotal.plus(exclusiveTaxTotal);
  const discountAmount = resolveDiscountAmount(beforeDiscount, params.discount);
  const afterNegotiatedDiscount = beforeDiscount.minus(discountAmount);

  /**
   * A faixa é resolvida sobre o valor JÁ com o desconto negociado e ANTES do
   * desconto da condição de pagamento. Sem uma ordem fixa o cálculo não
   * converge: o desconto da condição muda o valor, que poderia mudar a faixa,
   * que poderia invalidar a própria condição.
   */
  const band = resolveValueBand(params.paymentValueBands, afterNegotiatedDiscount);
  const paymentCondition =
    params.paymentConditions.find(
      (condition) => condition.id === params.paymentConditionId && condition.active,
    ) ?? null;

  const paymentConditionAllowed =
    paymentCondition !== null &&
    (band === null || band.paymentConditionIds.includes(paymentCondition.id));

  const paymentDiscountAmount =
    paymentCondition && paymentConditionAllowed
      ? afterNegotiatedDiscount
          .times(new Decimal(paymentCondition.discountPercent).div(100))
          .toDecimalPlaces(6)
      : new Decimal(0);

  return {
    items,
    subtotal: subtotal.toDecimalPlaces(6),
    exclusiveTaxTotal: exclusiveTaxTotal.toDecimalPlaces(6),
    inclusiveTaxTotal: inclusiveTaxTotal.toDecimalPlaces(6),
    taxTotals: [...totalsByCode.values()],
    discountAmount,
    bandBaseAmount: afterNegotiatedDiscount.toDecimalPlaces(6),
    band,
    paymentCondition,
    paymentConditionAllowed,
    paymentDiscountAmount,
    total: afterNegotiatedDiscount.minus(paymentDiscountAmount).toDecimalPlaces(6),
  };
}

/** Condições que a faixa do valor libera. Sem faixa configurada, todas valem. */
export function availablePaymentConditions(
  conditions: PaymentCondition[],
  bands: PaymentValueBand[],
  amount: Decimal,
): PaymentCondition[] {
  const active = conditions.filter((condition) => condition.active);
  const band = resolveValueBand(bands, amount);
  if (!band) return active;
  return active.filter((condition) => band.paymentConditionIds.includes(condition.id));
}

/**
 * Rótulo impresso do orçamento, derivado de `quotes.sequence`. A numeração é
 * um inteiro por organização; o prefixo é só apresentação, e não é persistido
 * para não existirem duas fontes de verdade para o mesmo número.
 */
export function formatQuoteNumber(sequence: number): string {
  return `ORC-${String(sequence).padStart(4, "0")}`;
}

export { round2 };
