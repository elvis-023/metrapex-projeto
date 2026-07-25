import type { FakeQuote } from "@/lib/mock-data";

export type DashboardPeriod = "7d" | "30d" | "90d";

export const dashboardPeriodOptions: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export type FunnelStage = {
  status: FakeQuote["status"];
  label: string;
  count: number;
};

export type SourceBreakdown = {
  sourceId: string;
  count: number;
};

/**
 * Formato de retorno alinhado ao que a query real (Milestone 19) vai
 * devolver: valores numéricos crus, não strings pré-formatadas — a
 * formatação pt-BR (moeda, porcentagem) acontece nos componentes via
 * `lib/dashboard/format.ts`.
 */
export type DashboardMetrics = {
  quotesGenerated: { count: number; previousCount: number };
  pipelineValue: { amount: number; openQuotesCount: number };
  conversionRate: { rate: number; previousRate: number };
  avgTimeToFirstQuoteSeconds: number;
  funnel: FunnelStage[];
  expiringQuotes: FakeQuote[];
  sourceBreakdown: SourceBreakdown[];
};

const metricsByPeriod: Record<
  DashboardPeriod,
  Omit<DashboardMetrics, "funnel" | "expiringQuotes" | "sourceBreakdown">
> = {
  "7d": {
    quotesGenerated: { count: 9, previousCount: 7 },
    pipelineValue: { amount: 12480, openQuotesCount: 4 },
    conversionRate: { rate: 0.27, previousRate: 0.25 },
    avgTimeToFirstQuoteSeconds: 228,
  },
  "30d": {
    quotesGenerated: { count: 24, previousCount: 21 },
    pipelineValue: { amount: 38940, openQuotesCount: 9 },
    conversionRate: { rate: 0.31, previousRate: 0.27 },
    avgTimeToFirstQuoteSeconds: 252,
  },
  "90d": {
    quotesGenerated: { count: 71, previousCount: 60 },
    pipelineValue: { amount: 96310, openQuotesCount: 22 },
    conversionRate: { rate: 0.34, previousRate: 0.28 },
    avgTimeToFirstQuoteSeconds: 280,
  },
};

const funnelByPeriod: Record<DashboardPeriod, FunnelStage[]> = {
  "7d": [
    { status: "gerado", label: "Gerado", count: 9 },
    { status: "enviado", label: "Enviado", count: 7 },
    { status: "negociacao", label: "Em negociação", count: 4 },
    { status: "convertido", label: "Convertido", count: 3 },
    { status: "expirado", label: "Expirado", count: 1 },
  ],
  "30d": [
    { status: "gerado", label: "Gerado", count: 24 },
    { status: "enviado", label: "Enviado", count: 19 },
    { status: "negociacao", label: "Em negociação", count: 11 },
    { status: "convertido", label: "Convertido", count: 8 },
    { status: "expirado", label: "Expirado", count: 4 },
  ],
  "90d": [
    { status: "gerado", label: "Gerado", count: 71 },
    { status: "enviado", label: "Enviado", count: 58 },
    { status: "negociacao", label: "Em negociação", count: 33 },
    { status: "convertido", label: "Convertido", count: 24 },
    { status: "expirado", label: "Expirado", count: 10 },
  ],
};

const expiringQuotesByPeriod: Record<DashboardPeriod, FakeQuote[]> = {
  "7d": [
    {
      id: "q_101",
      number: "ORC-0132",
      customerName: "Farmácia Vitalis",
      sourceId: "site",
      total: 2140,
      status: "enviado",
      expiresAt: "2026-07-25",
    },
    {
      id: "q_102",
      number: "ORC-0131",
      customerName: "Distribuidora Nortão",
      sourceId: "crm",
      total: 5870.4,
      status: "negociacao",
      expiresAt: "2026-07-26",
    },
  ],
  "30d": [
    {
      id: "q_102",
      number: "ORC-0131",
      customerName: "Distribuidora Nortão",
      sourceId: "crm",
      total: 5870.4,
      status: "negociacao",
      expiresAt: "2026-07-26",
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
  ],
  "90d": [
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
      id: "q_90",
      number: "ORC-0090",
      customerName: "Papelaria Central",
      sourceId: "crm",
      total: 780,
      status: "enviado",
      expiresAt: "2026-07-29",
    },
  ],
};

const sourceBreakdownByPeriod: Record<DashboardPeriod, SourceBreakdown[]> = {
  "7d": [
    { sourceId: "site", count: 5 },
    { sourceId: "crm", count: 4 },
  ],
  "30d": [
    { sourceId: "site", count: 14 },
    { sourceId: "crm", count: 10 },
  ],
  "90d": [
    { sourceId: "site", count: 39 },
    { sourceId: "crm", count: 32 },
  ],
};

/**
 * Milestone 19 troca o corpo desta função por uma query real (Supabase),
 * mantendo a assinatura e o formato de retorno `DashboardMetrics` — os
 * componentes de `components/dashboard/` não precisam mudar.
 */
export async function getDashboardMetrics(period: DashboardPeriod): Promise<DashboardMetrics> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {
    ...metricsByPeriod[period],
    funnel: funnelByPeriod[period],
    expiringQuotes: expiringQuotesByPeriod[period],
    sourceBreakdown: sourceBreakdownByPeriod[period],
  };
}
