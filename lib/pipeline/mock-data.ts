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
  /**
   * Nome real do responsável quando o orçamento vem do banco (Milestone 14).
   * Os cards mockados não têm — caem no `fakeSalespeople` por `assigneeId`.
   */
  assigneeName?: string | null;
  revision: number;
  /** Id da revisão anterior deste mesmo orçamento (mesmo `number`), quando existir. */
  previousRevisionId?: string;
  /** Preenchido quando uma revisão mais nova substituiu esta — marca o registro como antigo. */
  supersededByRevisionId?: string;
};

const salespersonById = new Map(fakeSalespeople.map((person) => [person.id, person]));

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase() ||
    "?"
  );
}

/**
 * Responsável exibido no card. A PRESENÇA da chave `assigneeName` distingue as
 * duas origens: orçamento vindo do banco sempre a define (nome do perfil ou
 * `null`), card mockado nunca. Sem essa distinção, um orçamento real sem dono
 * resolvível cairia no primeiro vendedor mockado e exibiria o nome errado.
 */
export function resolveAssignee(quote: PipelineQuote): { name: string; initials: string } {
  if (quote.assigneeName !== undefined) {
    return quote.assigneeName
      ? { name: quote.assigneeName, initials: initialsOf(quote.assigneeName) }
      : { name: "Não atribuído", initials: "—" };
  }
  const salesperson = salespersonById.get(quote.assigneeId) ?? fakeSalespeople[0];
  return { name: salesperson.name, initials: salesperson.initials };
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
    revision: 1,
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
