/**
 * Tipos do motor de impostos configurável (Milestone 12).
 * Espelham o schema de briefing-motor-impostos.md §3 — cada tributo é uma
 * linha de configuração (`tax_types`), nunca uma coluna do produto.
 */
export type TaxMode = "inclusive" | "exclusive";
export type RateSource = "org_default" | "category" | "product";

export type TaxType = {
  id: string;
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;
  active: boolean;
  displayOrder: number;
};

export type TaxRateOverride = {
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

/** Só os campos de que `resolveRate`/`calcItemTaxes` precisam do produto. */
export type TaxableProduct = {
  id: string;
  categoryId: string | null;
};
