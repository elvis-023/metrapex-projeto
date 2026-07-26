import type { Product, ProductCategory } from "@/lib/catalog/types";

/**
 * Dado mockado que sobrevive à Milestone 14: só o formulário público
 * (`app/(public-form)/`) ainda lê catálogo daqui, até a Milestone 15 resolver a
 * organização pela chave do snippet. As telas do catálogo (Milestone 6) e o
 * construtor de orçamento (Milestone 14) já usam dado real — ver
 * `lib/catalog/queries.ts` e `lib/quotes/queries.ts`.
 */

export const fakeCategories: ProductCategory[] = [
  { id: "cat_ferramentas", name: "Ferramentas" },
  { id: "cat_material-eletrico", name: "Material elétrico" },
  { id: "cat_hidraulica", name: "Hidráulica" },
  { id: "cat_acabamento", name: "Acabamento" },
];

export const fakeProducts: Product[] = [
  {
    id: "prd_1",
    externalCode: "PRD-001",
    name: "Cimento CP-II 50kg",
    price: 34.9,
    stock: 320,
    categoryId: "cat_acabamento",
    photoUrl: null,
    alternativeTitle: "Cimento Portland CP-II",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: false,
    leadTime: "Entrega imediata",
  },
  {
    id: "prd_2",
    externalCode: "PRD-002",
    name: "Argamassa ACIII 20kg",
    price: 22.5,
    stock: 180,
    categoryId: "cat_acabamento",
    photoUrl: null,
    alternativeTitle: "",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: false,
    leadTime: "Entrega imediata",
  },
  {
    id: "prd_3",
    externalCode: "PRD-003",
    name: "Vergalhão 10mm 12m",
    price: 58,
    stock: 96,
    categoryId: "cat_ferramentas",
    photoUrl: null,
    alternativeTitle: "Vergalhão de aço CA-50",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: true,
    leadTime: "3 dias úteis",
  },
  {
    id: "prd_4",
    externalCode: "PRD-010",
    name: "Furadeira de impacto 750W",
    price: 289.9,
    stock: 14,
    categoryId: "cat_ferramentas",
    photoUrl: null,
    alternativeTitle: "",
    catalogUrl: "https://exemplo.com.br/catalogo/furadeira-750w",
    manualUrl: "https://exemplo.com.br/manuais/furadeira-750w.pdf",
    videoUrl: "",
    certificateEligible: true,
    leadTime: "5 dias úteis",
  },
  {
    id: "prd_5",
    externalCode: "PRD-011",
    name: "Disjuntor bipolar 40A",
    price: 47.3,
    stock: 62,
    categoryId: "cat_material-eletrico",
    photoUrl: null,
    alternativeTitle: "",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: true,
    leadTime: "Entrega imediata",
  },
  {
    id: "prd_6",
    externalCode: "PRD-012",
    name: "Cabo flexível 2,5mm (rolo 100m)",
    price: 168.4,
    stock: 40,
    categoryId: "cat_material-eletrico",
    photoUrl: null,
    alternativeTitle: "Cabo flexível 750V",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: false,
    leadTime: "Entrega imediata",
  },
  {
    id: "prd_7",
    externalCode: "PRD-020",
    name: 'Registro de gaveta 3/4"',
    price: 39.9,
    stock: 55,
    categoryId: "cat_hidraulica",
    photoUrl: null,
    alternativeTitle: "",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: false,
    leadTime: "Entrega imediata",
  },
  {
    id: "prd_8",
    externalCode: "PRD-021",
    name: "Caixa d'água 500L",
    price: 312,
    stock: 8,
    categoryId: "cat_hidraulica",
    photoUrl: null,
    alternativeTitle: "",
    catalogUrl: "https://exemplo.com.br/catalogo/caixa-dagua-500l",
    manualUrl: "",
    videoUrl: "https://exemplo.com.br/videos/instalacao-caixa-dagua",
    certificateEligible: false,
    leadTime: "7 dias úteis",
  },
  {
    id: "prd_9",
    externalCode: "PRD-030",
    name: "Tinta acrílica fosca 18L",
    price: 249,
    stock: 27,
    categoryId: null,
    photoUrl: null,
    alternativeTitle: "",
    catalogUrl: "",
    manualUrl: "",
    videoUrl: "",
    certificateEligible: false,
    leadTime: "Entrega imediata",
  },
];

export async function getProducts(): Promise<Product[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return fakeProducts;
}

export async function getCategories(): Promise<ProductCategory[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return fakeCategories;
}
