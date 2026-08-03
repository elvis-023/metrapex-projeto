import Decimal from "decimal.js";

import { getAuthUser, getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatQuoteNumber, round2 } from "@/lib/quotes/engine";
import {
  getQuoteBuilderData,
  resolveDraftTotals,
  type DraftQuoteInput,
} from "@/lib/quotes/queries";
import type { Database } from "@/lib/supabase/types";
import type { FakeQuote, FakeQuoteStatus } from "@/lib/mock-data";
import {
  dashboardPeriodOptions,
  type DashboardMetrics,
  type DashboardPeriod,
  type FunnelStage,
  type SourceBreakdown,
} from "@/lib/dashboard/types";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];

const OPEN_STATUSES: FakeQuoteStatus[] = ["gerado", "enviado", "negociacao"];

const funnelLabels: Record<FakeQuoteStatus, string> = {
  gerado: "Gerado",
  enviado: "Enviado",
  negociacao: "Em negociação",
  convertido: "Convertido",
  expirado: "Expirado",
};

function periodDays(period: DashboardPeriod): number {
  const option = dashboardPeriodOptions.find((entry) => entry.value === period);
  return option ? Number(option.value.replace("d", "")) : 30;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const QUOTE_METRICS_COLUMNS =
  "id, sequence, status, owner_id, customer_name, customer_source_id, discount_type, " +
  "discount_value, payment_condition_id, tax_snapshot_at, total, expires_at, created_at";

type QuoteMetricsRow = Pick<
  QuoteRow,
  | "id"
  | "sequence"
  | "status"
  | "owner_id"
  | "customer_name"
  | "customer_source_id"
  | "discount_type"
  | "discount_value"
  | "payment_condition_id"
  | "tax_snapshot_at"
  | "total"
  | "expires_at"
  | "created_at"
>;

/**
 * Uma única leitura cobre o período atual E o anterior (para os deltas dos
 * cards) — a query pega tudo desde `2x` o tamanho do período e a partição
 * entre "atual" e "anterior" acontece em memória logo abaixo, em vez de duas
 * consultas idênticas ao banco. `superseded_by_revision_id is null` (só
 * revisão atual) e o filtro por `org_id` + `created_at` casam com o índice
 * parcial `quotes_org_created_current` (migration 20260727000015).
 */
async function loadQuotesWindow(orgId: string, sinceIso: string): Promise<QuoteMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(QUOTE_METRICS_COLUMNS)
    .eq("org_id", orgId)
    .is("superseded_by_revision_id", null)
    .gte("created_at", sinceIso)
    .returns<QuoteMetricsRow[]>();
  return data ?? [];
}

/** Orçamentos do vendedor logado com validade próxima — sem relação com o filtro de período. */
async function loadExpiringQuotesRaw(orgId: string, ownerId: string): Promise<QuoteMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(QUOTE_METRICS_COLUMNS)
    .eq("org_id", orgId)
    .eq("owner_id", ownerId)
    .is("superseded_by_revision_id", null)
    .in("status", OPEN_STATUSES)
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: true })
    .limit(5)
    .returns<QuoteMetricsRow[]>();
  return data ?? [];
}

function conversionRate(rows: { status: string }[]): number {
  if (rows.length === 0) return 0;
  return rows.filter((row) => row.status === "convertido").length / rows.length;
}

const EMPTY_METRICS: DashboardMetrics = {
  quotesGenerated: { count: 0, previousCount: 0 },
  pipelineValue: { amount: 0, openQuotesCount: 0 },
  conversionRate: { rate: 0, previousRate: 0 },
  funnel: [],
  expiringQuotes: [],
  sourceBreakdown: [],
};

export async function getDashboardMetrics(period: DashboardPeriod): Promise<DashboardMetrics> {
  const org = await getCurrentOrganization();
  if (!org) return EMPTY_METRICS;

  const days = periodDays(period);
  const currentSince = daysAgoIso(days);
  const previousSince = daysAgoIso(days * 2);

  const user = await getAuthUser();
  const [windowRows, expiringRows] = await Promise.all([
    loadQuotesWindow(org.id, previousSince),
    user ? loadExpiringQuotesRaw(org.id, user.id) : Promise.resolve([]),
  ]);

  const currentRows = windowRows.filter((row) => row.created_at >= currentSince);
  const previousRows = windowRows.filter((row) => row.created_at < currentSince);

  // Rascunho (`tax_snapshot_at` nulo) tem `total` nulo no banco — recalculado
  // uma única vez para os dois conjuntos (cards do período + "vencendo em
  // breve"), com a configuração fiscal/catálogo buscada só se algum dos dois
  // realmente tiver rascunho (comum ser zero: o formulário público sempre
  // nasce emitido, Milestone 15).
  const draftsById = new Map<string, DraftQuoteInput>();
  for (const row of [...currentRows, ...expiringRows]) {
    if (row.tax_snapshot_at === null) draftsById.set(row.id, row);
  }
  let draftTotals = new Map<string, number>();
  if (draftsById.size > 0) {
    const builderData = await getQuoteBuilderData();
    if (builderData) draftTotals = await resolveDraftTotals([...draftsById.values()], builderData);
  }
  const totalOf = (row: QuoteMetricsRow) =>
    row.total === null ? (draftTotals.get(row.id) ?? 0) : round2(new Decimal(row.total)).toNumber();

  const openRows = currentRows.filter((row) =>
    OPEN_STATUSES.includes(row.status as FakeQuoteStatus),
  );
  const pipelineAmount = openRows.reduce((sum, row) => sum + totalOf(row), 0);

  const funnel: FunnelStage[] = (Object.keys(funnelLabels) as FakeQuoteStatus[]).map((status) => ({
    status,
    label: funnelLabels[status],
    count: currentRows.filter((row) => row.status === status).length,
  }));

  const sourceCounts = new Map<string, number>();
  for (const row of currentRows) {
    if (!row.customer_source_id) continue;
    sourceCounts.set(row.customer_source_id, (sourceCounts.get(row.customer_source_id) ?? 0) + 1);
  }
  const sourceBreakdown: SourceBreakdown[] = [...sourceCounts.entries()].map(
    ([sourceId, count]) => ({
      sourceId,
      count,
    }),
  );

  const expiringQuotes: FakeQuote[] = expiringRows.map((row) => ({
    id: row.id,
    number: formatQuoteNumber(row.sequence),
    customerName: row.customer_name,
    sourceId: row.customer_source_id ?? "crm",
    total: totalOf(row),
    status: row.status,
    expiresAt: row.expires_at!,
  }));

  return {
    quotesGenerated: { count: currentRows.length, previousCount: previousRows.length },
    pipelineValue: {
      amount: round2(new Decimal(pipelineAmount)).toNumber(),
      openQuotesCount: openRows.length,
    },
    conversionRate: {
      rate: conversionRate(currentRows),
      previousRate: conversionRate(previousRows),
    },
    funnel,
    expiringQuotes,
    sourceBreakdown,
  };
}
