import type { FakeQuote, FakeQuoteStatus } from "@/lib/mock-data";

export type PipelineStage = {
  status: FakeQuoteStatus;
  label: string;
};

export const pipelineStages: PipelineStage[] = [
  { status: "gerado", label: "Gerado" },
  { status: "enviado", label: "Enviado" },
  { status: "negociacao", label: "Em negociação" },
  { status: "convertido", label: "Convertido" },
  { status: "expirado", label: "Expirado" },
];

export type Salesperson = {
  id: string;
  name: string;
  initials: string;
};

export const fakeSalespeople: Salesperson[] = [
  { id: "user_1", name: "Elvis Ugwu", initials: "EU" },
  { id: "user_2", name: "Marina Costa", initials: "MC" },
  { id: "user_3", name: "Rafael Nunes", initials: "RN" },
];

export type PipelineQuote = FakeQuote & {
  assigneeId: string;
};

const salespersonById = new Map(fakeSalespeople.map((person) => [person.id, person]));

export function getSalesperson(assigneeId: string): Salesperson {
  return salespersonById.get(assigneeId) ?? fakeSalespeople[0];
}

export const fakePipelineQuotes: PipelineQuote[] = [
  {
    id: "q_1",
    number: "ORC-0128",
    customerName: "Padaria Bom Pão",
    sourceId: "site",
    total: 4280.5,
    status: "convertido",
    expiresAt: "2026-07-30",
    assigneeId: "user_1",
  },
  {
    id: "q_2",
    number: "ORC-0127",
    customerName: "Auto Peças Nova Era",
    sourceId: "crm",
    total: 1150,
    status: "enviado",
    expiresAt: "2026-07-27",
    assigneeId: "user_2",
  },
  {
    id: "q_3",
    number: "ORC-0126",
    customerName: "Studio Fotográfico Luz",
    sourceId: "site",
    total: 890.9,
    status: "negociacao",
    expiresAt: "2026-07-26",
    assigneeId: "user_1",
  },
  {
    id: "q_4",
    number: "ORC-0125",
    customerName: "Mercado Central",
    sourceId: "crm",
    total: 6320,
    status: "gerado",
    expiresAt: "2026-07-25",
    assigneeId: "user_3",
  },
  {
    id: "q_5",
    number: "ORC-0124",
    customerName: "Oficina do Zé",
    sourceId: "site",
    total: 430,
    status: "expirado",
    expiresAt: "2026-07-18",
    assigneeId: "user_2",
  },
  {
    id: "q_101",
    number: "ORC-0132",
    customerName: "Farmácia Vitalis",
    sourceId: "site",
    total: 2140,
    status: "enviado",
    expiresAt: "2026-07-25",
    assigneeId: "user_1",
  },
  {
    id: "q_102",
    number: "ORC-0131",
    customerName: "Distribuidora Nortão",
    sourceId: "crm",
    total: 5870.4,
    status: "negociacao",
    expiresAt: "2026-07-26",
    assigneeId: "user_3",
  },
  {
    id: "q_103",
    number: "ORC-0133",
    customerName: "Papelaria Central",
    sourceId: "crm",
    total: 780,
    status: "gerado",
    expiresAt: "2026-07-29",
    assigneeId: "user_2",
  },
  {
    id: "q_104",
    number: "ORC-0130",
    customerName: "Restaurante Sabor & Arte",
    sourceId: "site",
    total: 3210.75,
    status: "convertido",
    expiresAt: "2026-07-20",
    assigneeId: "user_3",
  },
  {
    id: "q_105",
    number: "ORC-0129",
    customerName: "Construtora Alicerce",
    sourceId: "crm",
    total: 12450,
    status: "expirado",
    expiresAt: "2026-07-15",
    assigneeId: "user_1",
  },
];

export type PipelineActivityType = "criacao" | "envio" | "mudanca_status" | "nota" | "follow_up";

export type PipelineActivity = {
  id: string;
  type: PipelineActivityType;
  label: string;
  detail?: string;
  timestamp: string;
  author: string;
};

const fakeActivitiesByQuoteId: Record<string, PipelineActivity[]> = {
  q_1: [
    {
      id: "act_1_1",
      type: "criacao",
      label: "Orçamento gerado",
      timestamp: "2026-07-15T09:12:00-03:00",
      author: "Formulário público",
    },
    {
      id: "act_1_2",
      type: "envio",
      label: "Enviado por e-mail ao cliente",
      timestamp: "2026-07-15T09:12:30-03:00",
      author: "Sistema",
    },
    {
      id: "act_1_3",
      type: "mudanca_status",
      label: "Movido para Em negociação",
      timestamp: "2026-07-17T14:05:00-03:00",
      author: "Elvis Ugwu",
    },
    {
      id: "act_1_4",
      type: "nota",
      label: "Nota adicionada",
      detail: "Cliente pediu desconto de 5% para pagamento à vista.",
      timestamp: "2026-07-18T10:40:00-03:00",
      author: "Elvis Ugwu",
    },
    {
      id: "act_1_5",
      type: "mudanca_status",
      label: "Movido para Convertido",
      timestamp: "2026-07-20T16:22:00-03:00",
      author: "Elvis Ugwu",
    },
  ],
  q_2: [
    {
      id: "act_2_1",
      type: "criacao",
      label: "Orçamento gerado",
      timestamp: "2026-07-20T11:00:00-03:00",
      author: "Marina Costa",
    },
    {
      id: "act_2_2",
      type: "envio",
      label: "Enviado por e-mail ao cliente",
      timestamp: "2026-07-20T11:03:00-03:00",
      author: "Sistema",
    },
    {
      id: "act_2_3",
      type: "follow_up",
      label: "Follow-up automático disparado",
      timestamp: "2026-07-23T09:00:00-03:00",
      author: "Automação",
    },
  ],
};

const defaultActivities = (quote: PipelineQuote): PipelineActivity[] => [
  {
    id: `act_${quote.id}_1`,
    type: "criacao",
    label: "Orçamento gerado",
    timestamp: `${quote.expiresAt}T08:00:00-03:00`,
    author: getSalesperson(quote.assigneeId).name,
  },
];

export async function getPipelineQuotes(): Promise<PipelineQuote[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return fakePipelineQuotes;
}

export async function getPipelineQuoteById(id: string): Promise<PipelineQuote | null> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return fakePipelineQuotes.find((quote) => quote.id === id) ?? null;
}

export async function getQuoteActivities(quote: PipelineQuote): Promise<PipelineActivity[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return fakeActivitiesByQuoteId[quote.id] ?? defaultActivities(quote);
}
