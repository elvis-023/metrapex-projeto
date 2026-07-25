import Decimal from "decimal.js";

import { resolveRate } from "@/lib/tax-engine/resolve-rate";
import type {
  RateSource,
  TaxableProduct,
  TaxMode,
  TaxRateOverride,
  TaxType,
} from "@/lib/tax-engine/types";

/**
 * Convenção de precisão (CLAUDE.md / briefing §3): tudo internamente em
 * `numeric(18,6)` via decimal.js, nunca `number` de ponto flutuante puro.
 * Arredondar para 2 casas (half-up) é responsabilidade só da renderização
 * e da soma do rodapé (`round2`/`documentTotals`) — nunca do cálculo em si.
 */

export type TaxLine = { base: Decimal; tax: Decimal; gross: Decimal };

/**
 * Fórmula pura de um tributo isolado sobre um preço (briefing §5).
 * Não cumulativo: `price` é sempre o preço de catálogo (ou o valor da
 * linha), jamais o resultado de outro tributo. `rate = 0` é neutro nos
 * dois modos, sem `if` especial — isenção é configuração, não caso
 * especial no código.
 */
export function calcTax(price: Decimal.Value, rate: number, mode: TaxMode): TaxLine {
  const p = new Decimal(price);
  const r = new Decimal(rate).div(100);

  if (mode === "inclusive") {
    // O preço já contém o imposto: extrai-se a base. rate=0 → div(1) → base = preço.
    // `tax` deriva da base em precisão TOTAL (`baseFullPrecision`), não da base
    // já arredondada em 6 casas — senão o arredondamento intermediário quebra
    // a identidade `base + tax === preço` (briefing §5 proíbe arredondar entre
    // a extração da base e o cálculo do imposto).
    const baseFullPrecision = p.div(r.plus(1));
    const base = baseFullPrecision.toDecimalPlaces(6);
    const tax = baseFullPrecision.times(r).toDecimalPlaces(6);
    return { base, tax, gross: p.toDecimalPlaces(6) };
  }

  // exclusive: o imposto é somado ao preço.
  const tax = p.times(r).toDecimalPlaces(6);
  return { base: p.toDecimalPlaces(6), tax, gross: p.plus(tax).toDecimalPlaces(6) };
}

export type TaxLineResult = {
  taxTypeId: string;
  taxCode: string;
  taxLabel: string;
  mode: TaxMode;
  rateApplied: number;
  rateSource: RateSource;
  note: string | null;
  baseAmount: Decimal;
  taxAmount: Decimal;
};

export type ItemTaxCalculation = {
  unitPriceCharged: Decimal;
  unitBaseDisplay: Decimal;
  lineTotal: Decimal;
  taxes: TaxLineResult[];
};

/**
 * Calcula todos os tributos ativos de um item de orçamento.
 *
 * Ordem obrigatória (briefing §5): `preço unitário × quantidade` PRIMEIRO,
 * imposto depois — nunca por unidade com arredondamento intermediário
 * (diverge a base em centavos, ver skill calculo-tributario §2).
 *
 * Não cumulativo: cada tributo olha para o mesmo `linePrice` de partida,
 * nunca para a base/valor de outro tributo — o resultado é comutativo em
 * relação a `displayOrder`, que serve só para ordenar a impressão.
 */
export function calcItemTaxes(params: {
  product: TaxableProduct;
  unitPrice: Decimal.Value;
  quantity: Decimal.Value;
  taxTypes: TaxType[];
  overrides: TaxRateOverride[];
}): ItemTaxCalculation {
  const { product, unitPrice, quantity, taxTypes, overrides } = params;
  const qty = new Decimal(quantity);
  const linePrice = new Decimal(unitPrice).times(qty);

  let baseForDisplay = linePrice;
  let exclusiveTotal = new Decimal(0);
  const taxes: TaxLineResult[] = [];

  /**
   * Qual base vira `unitBaseDisplay` quando há MAIS DE UM tributo `inclusive`
   * no mesmo item não está definido no briefing (§11 / skill calculo-tributario
   * §9) — cada `taxAmount` individual continua correto e comutativo (não
   * cumulativo), mas o unitário exibido não pode depender da ordem incidental
   * de chegada do array. Ordenar por `display_order` só torna esse valor
   * determinístico e controlável pela organização; não resolve a pergunta em
   * aberto. Não decida essa semântica aqui — consulte a skill decisao-pendente.
   */
  const orderedTaxTypes = [...taxTypes]
    .filter((t) => t.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  for (const taxType of orderedTaxTypes) {
    const resolved = resolveRate(taxType, product, overrides);
    const { base, tax } = calcTax(linePrice, resolved.rate, taxType.mode);

    if (taxType.mode === "inclusive") {
      baseForDisplay = base;
    } else {
      exclusiveTotal = exclusiveTotal.plus(tax);
    }

    taxes.push({
      taxTypeId: taxType.id,
      taxCode: taxType.code,
      taxLabel: taxType.label,
      mode: taxType.mode,
      rateApplied: resolved.rate,
      rateSource: resolved.source,
      note: resolved.note,
      baseAmount: base,
      taxAmount: tax,
    });
  }

  return {
    unitPriceCharged: new Decimal(unitPrice).toDecimalPlaces(6),
    unitBaseDisplay: baseForDisplay.div(qty).toDecimalPlaces(6),
    lineTotal: linePrice.plus(exclusiveTotal).toDecimalPlaces(6),
    taxes,
  };
}

/** Arredondamento half-up para 2 casas — só na renderização/soma do rodapé. */
export function round2(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Totais do documento: soma em 6 casas (`numeric(18,6)`) e só então
 * arredonda para 2 casas — arredondar linha a linha antes de somar diverge
 * centavos em documentos com vários itens (briefing §5, skill §5).
 */
export function documentTotals(items: ItemTaxCalculation[]) {
  let total = new Decimal(0);
  const byCode = new Map<string, Decimal>();

  for (const item of items) {
    total = total.plus(item.lineTotal);
    for (const tax of item.taxes) {
      byCode.set(tax.taxCode, (byCode.get(tax.taxCode) ?? new Decimal(0)).plus(tax.taxAmount));
    }
  }

  return {
    total: round2(total),
    taxesByCode: new Map([...byCode].map(([code, value]) => [code, round2(value)])),
  };
}
