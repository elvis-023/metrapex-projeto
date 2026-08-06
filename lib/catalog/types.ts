export type ProductCategory = {
  id: string;
  name: string;
  /** 8 dígitos, obrigatório (Bloco 1) — dado cadastral da categoria, não do produto. */
  ncm: string;
};

/**
 * `price` é `number` aqui só para exibição/formulário (a Milestone 13 já
 * persiste de verdade em `products.price numeric(18,6)` — ver
 * lib/catalog/queries.ts, lib/catalog/actions.ts). Este tipo é a forma que a
 * UI do Milestone 6 consome, NÃO a forma de cálculo: o motor de orçamento
 * (Milestone 14) não deve reaproveitar `Product`/`getProductById` para
 * calcular imposto — precisa ler o preço direto da coluna e reconverter para
 * Decimal, conforme a convenção de dinheiro do briefing §3 (nunca number de
 * ponto flutuante puro, nem de passagem).
 */
export type Product = {
  id: string;
  externalCode: string;
  name: string;
  price: number;
  stock: number;
  categoryId: string | null;
  photoUrl: string | null;
  alternativeTitle: string;
  catalogUrl: string;
  manualUrl: string;
  videoUrl: string;
  certificateEligible: boolean;
  leadTime: string;
};

export type ProductImportRowStatus = "ok" | "erro";

export type ProductImportRow = {
  row: number;
  externalCode: string;
  name: string;
  price: string;
  stock: string;
  category: string;
  status: ProductImportRowStatus;
  error?: string;
};
