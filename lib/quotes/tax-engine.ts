export type TaxMode = "inclusive" | "exclusive";
export type RateSource = "org_default" | "category" | "product";

export type MockTaxType = {
  id: string;
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;
};

export type MockTaxRateOverride = {
  taxTypeId: string;
  categoryId: string | null;
  productId: string | null;
  rate: number;
  note: string | null;
};

export type ResolvedRate = {
  rate: number;
  source: RateSource;
  note: string | null;
};

/**
 * Espelha `resolveRate` de briefing-motor-impostos.md §4 — produto vence
 * categoria, que vence o padrão da organização. Override com rate = 0 é
 * override válido e vence normalmente, não cai para o nível de cima.
 * Implementação de vitrine para a forma da tela; o motor real (lido do
 * schema) entra no Milestone 12.
 */
export function resolveMockRate(
  taxType: MockTaxType,
  productId: string,
  categoryId: string | null,
  overrides: MockTaxRateOverride[],
): ResolvedRate {
  const byProduct = overrides.find(
    (override) => override.taxTypeId === taxType.id && override.productId === productId,
  );
  if (byProduct) {
    return { rate: byProduct.rate, source: "product", note: byProduct.note };
  }

  if (categoryId) {
    const byCategory = overrides.find(
      (override) => override.taxTypeId === taxType.id && override.categoryId === categoryId,
    );
    if (byCategory) {
      return { rate: byCategory.rate, source: "category", note: byCategory.note };
    }
  }

  return { rate: taxType.defaultRate, source: "org_default", note: null };
}

export type TaxLine = { base: number; tax: number; gross: number };

/**
 * Espelha `calcTax` do briefing §5 — não cumulativo, cálculo sobre o
 * valor da linha (preço unitário × quantidade), nunca por unidade
 * arredondada. rate = 0 é neutro nos dois modos, sem branch especial.
 */
export function calcMockTax(lineAmount: number, rate: number, mode: TaxMode): TaxLine {
  if (mode === "inclusive") {
    const base = lineAmount / (1 + rate / 100);
    const tax = base * (rate / 100);
    return { base, tax, gross: lineAmount };
  }
  const tax = lineAmount * (rate / 100);
  return { base: lineAmount, tax, gross: lineAmount + tax };
}
