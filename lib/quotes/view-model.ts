import Decimal from "decimal.js";

import { round2, type QuoteCalculation } from "@/lib/quotes/engine";
import type { QuoteLineItem, QuoteView } from "@/lib/quotes/types";

/**
 * Fronteira única entre o cálculo (`Decimal`, 6 casas) e a tela (`number`, 2
 * casas). O arredondamento half-up acontece exatamente aqui — depois de todas
 * as somas, nunca antes (briefing §5). Se algum componente precisar de um
 * total novo, ele vem daqui; nenhuma tela soma dinheiro por conta própria.
 */
function display(value: Decimal): number {
  return round2(value).toNumber();
}

export function toQuoteView(calculation: QuoteCalculation): QuoteView {
  const items: QuoteLineItem[] = calculation.items.map((item) => ({
    position: item.position,
    productId: item.productId,
    externalCode: item.productExternalCode,
    name: item.productName,
    photoUrl: item.photoUrl,
    unitPrice: display(item.unitPriceCharged),
    unitBaseDisplay: display(item.unitBaseDisplay),
    quantity: item.quantity.toNumber(),
    lineTotal: display(item.lineTotal),
    taxes: item.taxes.map((tax) => ({
      taxTypeId: tax.taxTypeId,
      code: tax.taxCode,
      label: tax.taxLabel,
      mode: tax.mode,
      rate: tax.rateApplied,
      source: tax.rateSource,
      note: tax.note,
      base: display(tax.baseAmount),
      amount: display(tax.taxAmount),
    })),
  }));

  return {
    items,
    subtotal: display(calculation.subtotal),
    exclusiveTaxTotal: display(calculation.exclusiveTaxTotal),
    inclusiveTaxTotal: display(calculation.inclusiveTaxTotal),
    taxTotals: calculation.taxTotals.map((tax) => ({
      code: tax.code,
      label: tax.label,
      mode: tax.mode,
      amount: display(tax.amount),
    })),
    discountAmount: display(calculation.discountAmount),
    paymentDiscountAmount: display(calculation.paymentDiscountAmount),
    total: display(calculation.total),
    bandLabel: calculation.band?.label ?? null,
    paymentConditionAllowed: calculation.paymentConditionAllowed,
  };
}
