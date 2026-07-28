import type { ReportFrequency } from "@/lib/supabase/types";

/**
 * Milestone 20 — relatórios e exportação. Tipos compartilhados entre os 8
 * relatórios pré-construídos, o relatório customizável, a exportação de dado
 * bruto e o envio agendado.
 *
 * Módulo 100% puro (sem `next/headers`/Supabase server client) de propósito
 * — é importado tanto por Server Components quanto por Client Components
 * (`components/reports/report-schedules-manager.tsx`,
 * `custom-report-builder.tsx`). `lib/reports/schedules.ts` e
 * `lib/reports/queries.ts` guardam a leitura de banco correspondente e só
 * podem ser importados do lado do servidor.
 */

export type ReportPeriod = "30d" | "90d" | "180d" | "12m";

export const reportPeriodOptions: { value: ReportPeriod; label: string; days: number }[] = [
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "180d", label: "Últimos 180 dias", days: 180 },
  { value: "12m", label: "Últimos 12 meses", days: 365 },
];

export function periodDays(period: ReportPeriod): number {
  return reportPeriodOptions.find((option) => option.value === period)?.days ?? 30;
}

/** Janela [from, to] resolvida de um período — `to` é sempre "agora". */
export type ReportFilters = { from: string; to: string };

/**
 * Pura (sem I/O) de propósito — vive aqui, não em `lib/reports/queries.ts`,
 * para poder ser chamada tanto do Server Component da página quanto do
 * `CustomReportBuilder` ("use client"), que não pode importar `queries.ts`
 * (puxaria `@/lib/supabase/server`, código server-only, para o bundle do client).
 */
export function resolveReportFilters(period: ReportPeriod): ReportFilters {
  const days = periodDays(period);
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

export type BucketUnit = "day" | "week" | "month";

/**
 * Granularidade do eixo de tempo dos relatórios de evolução — cresce com o
 * período para o gráfico nunca ultrapassar ~30 barras (30d: diário, 90d/180d:
 * semanal, 12m: mensal).
 */
export function bucketUnitForDays(days: number): BucketUnit {
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

export type TrendPoint = { bucket: string; label: string; value: number; count: number };

/** Linha de um relatório agrupado (por vendedor, origem ou faixa de valor). */
export type GroupedReportRow = {
  key: string;
  label: string;
  total: number;
  converted: number;
  rate: number;
};

export type ProductRankingRow = {
  productId: string | null;
  productExternalCode: string;
  productName: string;
  quotedCount: number;
  quotedQuantity: number;
  convertedCount: number;
};

export type PrebuiltReportKey =
  | "quotes_by_period"
  | "conversion_by_seller"
  | "conversion_by_source"
  | "conversion_by_band"
  | "average_ticket"
  | "expiration_rate"
  | "top_products"
  | "time_to_first_quote";

export const prebuiltReports: { key: PrebuiltReportKey; label: string; description: string }[] = [
  {
    key: "quotes_by_period",
    label: "Orçamentos por período",
    description: "Volume de orçamentos gerados, agrupado por dia, semana ou mês.",
  },
  {
    key: "conversion_by_seller",
    label: "Conversão por vendedor",
    description: "Taxa de conversão de cada vendedor no período.",
  },
  {
    key: "conversion_by_source",
    label: "Conversão por origem",
    description: "Taxa de conversão por origem do cliente (Site, CRM).",
  },
  {
    key: "conversion_by_band",
    label: "Conversão por faixa de valor",
    description: "Taxa de conversão por faixa de valor do orçamento emitido.",
  },
  {
    key: "average_ticket",
    label: "Ticket médio",
    description: "Valor médio dos orçamentos emitidos, com evolução no período.",
  },
  {
    key: "expiration_rate",
    label: "Taxa de expiração",
    description: "Proporção de orçamentos que venceram sem conversão.",
  },
  {
    key: "top_products",
    label: "Produtos mais orçados e mais convertidos",
    description: "Ranking de produtos por quantidade orçada e por orçamento convertido.",
  },
  {
    key: "time_to_first_quote",
    label: "Evolução do tempo até o primeiro orçamento",
    description: "KPI central do produto (CLAUDE.md) — evolução histórica, não só o período atual.",
  },
];

export function prebuiltReportLabel(key: string): string {
  return prebuiltReports.find((report) => report.key === key)?.label ?? key;
}

// ---------------------------------------------------------------------------
// Relatório customizável
// ---------------------------------------------------------------------------

export type CustomObject = "quotes" | "quote_items" | "customers";
export type CustomMetric = "count" | "sum" | "average";
export type CustomGroupBy =
  | "none"
  | "status"
  | "seller"
  | "source"
  | "band"
  | "period_day"
  | "period_week"
  | "period_month"
  | "product"
  | "category"
  | "document_type";

export const customObjectOptions: { value: CustomObject; label: string }[] = [
  { value: "quotes", label: "Orçamentos" },
  { value: "quote_items", label: "Itens de orçamento" },
  { value: "customers", label: "Clientes" },
];

export const customMetricOptions: { value: CustomMetric; label: string }[] = [
  { value: "count", label: "Contagem" },
  { value: "sum", label: "Soma" },
  { value: "average", label: "Média" },
];

/** Agrupamentos válidos por objeto — a UI só oferece o que faz sentido para o objeto escolhido. */
export const customGroupByOptionsByObject: Record<
  CustomObject,
  { value: CustomGroupBy; label: string }[]
> = {
  quotes: [
    { value: "none", label: "Sem agrupamento" },
    { value: "status", label: "Etapa" },
    { value: "seller", label: "Vendedor" },
    { value: "source", label: "Origem" },
    { value: "band", label: "Faixa de valor" },
    { value: "period_day", label: "Dia" },
    { value: "period_week", label: "Semana" },
    { value: "period_month", label: "Mês" },
  ],
  quote_items: [
    { value: "none", label: "Sem agrupamento" },
    { value: "product", label: "Produto" },
    { value: "category", label: "Categoria" },
  ],
  customers: [
    { value: "none", label: "Sem agrupamento" },
    { value: "document_type", label: "Tipo de documento (PF/PJ)" },
  ],
};

/** Métrica `sum`/`average` só faz sentido sobre um campo numérico do objeto — count sempre vale. */
export const customNumericMetricAllowed: Record<CustomObject, boolean> = {
  quotes: true, // total (só emitido)
  quote_items: true, // line_total (só emitido)
  customers: false, // sem campo monetário
};

export type CustomReportFilters = ReportFilters & { ownerId?: string; sourceId?: string };

export type CustomReportSpec = {
  object: CustomObject;
  metric: CustomMetric;
  groupBy: CustomGroupBy;
  filters: CustomReportFilters;
};

export type CustomReportResult = {
  groups: { key: string; label: string; value: number }[];
  metricLabel: string;
};

export function validateCustomReportSpec(spec: CustomReportSpec): string | null {
  const validGroupBys = customGroupByOptionsByObject[spec.object].map((option) => option.value);
  if (!validGroupBys.includes(spec.groupBy)) {
    return "Agrupamento inválido para o objeto escolhido.";
  }
  if (spec.metric !== "count" && !customNumericMetricAllowed[spec.object]) {
    return "Soma/média não estão disponíveis para este objeto — use contagem.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Exportação de dado bruto
// ---------------------------------------------------------------------------

export type ExportFormat = "csv" | "xlsx";
export type ExportRawObject = "quotes" | "quote_items" | "customers";

export type ExportedFile = { filename: string; base64: string; mimeType: string };

// ---------------------------------------------------------------------------
// Envio agendado
// ---------------------------------------------------------------------------

export type ReportSchedule = {
  id: string;
  name: string;
  reportKey: string;
  definition: Record<string, unknown>;
  frequency: ReportFrequency;
  recipients: string[];
  active: boolean;
  nextRunAt: string;
  lastSentAt: string | null;
};

export const frequencyLabels: Record<ReportFrequency, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
};

export const frequencyLookbackDays: Record<ReportFrequency, number> = {
  diario: 1,
  semanal: 7,
  mensal: 30,
};

/** Próxima data de envio a partir de agora, na mesma cadência da frequência. */
export function nextRunAtFor(frequency: ReportFrequency, from: Date = new Date()): string {
  const next = new Date(from);
  if (frequency === "diario") next.setDate(next.getDate() + 1);
  else if (frequency === "semanal") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}
