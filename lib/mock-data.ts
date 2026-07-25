export type FakeOrganization = {
  id: string;
  name: string;
  slug: string;
  plan: "Entrada" | "Profissional" | "Escala";
};

export const fakeOrganizations: FakeOrganization[] = [
  {
    id: "org_1",
    name: "Metrapex Distribuidora",
    slug: "metrapex-distribuidora",
    plan: "Profissional",
  },
  { id: "org_2", name: "Consultoria Ugwu", slug: "consultoria-ugwu", plan: "Entrada" },
  { id: "org_3", name: "Grafite Materiais", slug: "grafite-materiais", plan: "Escala" },
];

export const fakeCurrentOrganization = fakeOrganizations[0];

export type FakeQuoteStatus = "gerado" | "enviado" | "negociacao" | "convertido" | "expirado";

export type FakeQuote = {
  id: string;
  number: string;
  customerName: string;
  /** Referencia `CustomerSource.id` (`lib/customers/mock-data.ts`) — de onde o cliente chegou. */
  sourceId: string;
  total: number;
  status: FakeQuoteStatus;
  expiresAt: string;
};

export const fakeRecentQuotes: FakeQuote[] = [
  {
    id: "q_1",
    number: "ORC-0128",
    customerName: "Padaria Bom Pão",
    sourceId: "site",
    total: 4280.5,
    status: "convertido",
    expiresAt: "2026-07-30",
  },
  {
    id: "q_2",
    number: "ORC-0127",
    customerName: "Auto Peças Nova Era",
    sourceId: "crm",
    total: 1150,
    status: "enviado",
    expiresAt: "2026-07-27",
  },
  {
    id: "q_3",
    number: "ORC-0126",
    customerName: "Studio Fotográfico Luz",
    sourceId: "site",
    total: 890.9,
    status: "negociacao",
    expiresAt: "2026-07-26",
  },
  {
    id: "q_4",
    number: "ORC-0125",
    customerName: "Mercado Central",
    sourceId: "crm",
    total: 6320,
    status: "gerado",
    expiresAt: "2026-07-25",
  },
  {
    id: "q_5",
    number: "ORC-0124",
    customerName: "Oficina do Zé",
    sourceId: "site",
    total: 430,
    status: "expirado",
    expiresAt: "2026-07-18",
  },
];
