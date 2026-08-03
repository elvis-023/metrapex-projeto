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
 * Valores numéricos crus, não strings pré-formatadas — a formatação pt-BR
 * (moeda, porcentagem) acontece nos componentes via `lib/dashboard/format.ts`.
 */
export type DashboardMetrics = {
  quotesGenerated: { count: number; previousCount: number };
  pipelineValue: { amount: number; openQuotesCount: number };
  conversionRate: { rate: number; previousRate: number };
  funnel: FunnelStage[];
  expiringQuotes: FakeQuote[];
  sourceBreakdown: SourceBreakdown[];
};
