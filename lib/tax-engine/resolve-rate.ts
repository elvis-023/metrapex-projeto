import type {
  ResolvedRate,
  TaxableProduct,
  TaxRateOverride,
  TaxType,
} from "@/lib/tax-engine/types";

/**
 * Hierarquia produto > categoria > padrão da organização (briefing §4).
 *
 * Testa a EXISTÊNCIA da linha de override, nunca a "verdade" do `rate` —
 * um override com rate = 0 (isenção por ST) é válido e vence normalmente.
 * `if (byProduct?.rate)`, `||` ou `??` sobre o valor derrubariam a isenção
 * para o nível de cima e cobrariam imposto indevido (ver skill
 * calculo-tributario §4).
 */
export function resolveRate(
  taxType: TaxType,
  product: TaxableProduct,
  overrides: TaxRateOverride[],
): ResolvedRate {
  const byProduct = overrides.find(
    (override) => override.taxTypeId === taxType.id && override.productId === product.id,
  );
  if (byProduct) {
    return { rate: byProduct.rate, source: "product", note: byProduct.note };
  }

  if (product.categoryId) {
    const byCategory = overrides.find(
      (override) => override.taxTypeId === taxType.id && override.categoryId === product.categoryId,
    );
    if (byCategory) {
      return { rate: byCategory.rate, source: "category", note: byCategory.note };
    }
  }

  return { rate: taxType.defaultRate, source: "org_default", note: null };
}
