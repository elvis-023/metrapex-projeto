export type ProductCategory = {
  id: string;
  name: string;
};

/**
 * `price` é `number` só porque este milestone é UI com dados mockados —
 * o motor de orçamento (Milestone 14) é quem define o tipo de precisão real
 * usado em cálculo, conforme convenção de dinheiro no CLAUDE.md.
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
