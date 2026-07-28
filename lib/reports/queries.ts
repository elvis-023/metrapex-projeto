import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentOrganization } from "@/lib/auth/session";
import { getCustomerSource } from "@/lib/customers/mock-data";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/quotes/engine";
import { bucketKey, bucketLabel } from "@/lib/reports/format";
import {
  bucketUnitForDays,
  periodDays,
  resolveReportFilters,
  type BucketUnit,
  type GroupedReportRow,
  type ProductRankingRow,
  type ReportFilters,
  type ReportPeriod,
  type TrendPoint,
} from "@/lib/reports/types";
import type { Database } from "@/lib/supabase/types";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];

const REPORT_QUOTE_COLUMNS =
  "id, sequence, status, owner_id, customer_name, customer_source_id, payment_band_label, total, " +
  "tax_snapshot_at, requested_at, delivered_at, created_at, expires_at";

export type ReportQuoteRow = Pick<
  QuoteRow,
  | "id"
  | "sequence"
  | "status"
  | "owner_id"
  | "customer_name"
  | "customer_source_id"
  | "payment_band_label"
  | "total"
  | "tax_snapshot_at"
  | "requested_at"
  | "delivered_at"
  | "created_at"
  | "expires_at"
>;

/** Vendedores da organização atual — alimenta o filtro "por vendedor" do relatório customizável e dos agendamentos. */
export async function getOrgSellers(): Promise<{ id: string; name: string }[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, profiles(full_name)")
    .eq("org_id", org.id)
    .returns<
      { user_id: string; profiles: { full_name: string } | { full_name: string }[] | null }[]
    >();

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { id: row.user_id, name: profile?.full_name ?? "—" };
  });
}

/**
 * Só a revisão atual, na janela do relatório — mesmo índice parcial do
 * dashboard (Milestone 19). Aceita um client já pronto (service_role) para o
 * job de envio agendado (`app/api/automations/send-reports`), que não tem
 * sessão de usuário/cookie para `createClient()` resolver sozinho — mesmo
 * motivo pelo qual as automações da Milestone 18 usam service_role.
 */
export async function loadReportQuotes(
  orgId: string,
  filters: ReportFilters,
  client?: SupabaseClient<Database>,
): Promise<ReportQuoteRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("quotes")
    .select(REPORT_QUOTE_COLUMNS)
    .eq("org_id", orgId)
    .is("superseded_by_revision_id", null)
    .gte("created_at", filters.from)
    .lte("created_at", filters.to)
    .returns<ReportQuoteRow[]>();
  return data ?? [];
}

type ReportQuoteItemRow = {
  product_id: string | null;
  product_external_code: string;
  product_name: string;
  quantity: number;
  quotes: { status: string } | { status: string }[] | null;
};

/**
 * Itens de orçamento EMITIDO (invariante do §topo da migration 20260728000016)
 * — o relatório de produtos lê `quantity`/nomes do snapshot congelado, nunca
 * recalcula contra o catálogo vigente.
 */
async function loadReportQuoteItems(
  orgId: string,
  filters: ReportFilters,
): Promise<ReportQuoteItemRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quote_items")
    .select("product_id, product_external_code, product_name, quantity, quotes!inner(status)")
    .eq("quotes.org_id", orgId)
    .is("quotes.superseded_by_revision_id", null)
    .not("quotes.tax_snapshot_at", "is", null)
    .gte("quotes.created_at", filters.from)
    .lte("quotes.created_at", filters.to)
    .returns<ReportQuoteItemRow[]>();
  return data ?? [];
}

async function loadProfileNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((row) => [row.id, row.full_name]));
}

// ---------------------------------------------------------------------------
// Agregações compartilhadas
// ---------------------------------------------------------------------------

function conversionRate(total: number, converted: number): number {
  return total === 0 ? 0 : converted / total;
}

function groupForConversion(
  rows: ReportQuoteRow[],
  keyOf: (row: ReportQuoteRow) => string | null,
  labelOf: (key: string) => string,
): GroupedReportRow[] {
  const buckets = new Map<string, { total: number; converted: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const bucket = buckets.get(key) ?? { total: 0, converted: 0 };
    bucket.total += 1;
    if (row.status === "convertido") bucket.converted += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: labelOf(key),
      total: bucket.total,
      converted: bucket.converted,
      rate: conversionRate(bucket.total, bucket.converted),
    }))
    .sort((a, b) => b.total - a.total);
}

function buildTrend(
  rows: { created_at: string; value: number }[],
  unit: BucketUnit,
  reducer: (values: number[]) => number,
): TrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const key = bucketKey(new Date(row.created_at), unit);
    const existing = buckets.get(key) ?? [];
    existing.push(row.value);
    buckets.set(key, existing);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({
      bucket: key,
      label: bucketLabel(key, unit),
      value: reducer(values),
      count: values.length,
    }));
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length);

// ---------------------------------------------------------------------------
// Os 8 relatórios pré-construídos, calculados de uma vez (uma leitura de
// `quotes` + uma de `quote_items` para o período) — mesmo motivo de
// `getDashboardMetrics`: a página de relatórios pré-construídos mostra todos
// juntos, sob o mesmo filtro de período.
// ---------------------------------------------------------------------------

export type PrebuiltReportsData = {
  bucketUnit: BucketUnit;
  quotesByPeriod: TrendPoint[];
  conversionBySeller: GroupedReportRow[];
  conversionBySource: GroupedReportRow[];
  conversionByBand: GroupedReportRow[];
  averageTicket: { overall: number; trend: TrendPoint[] };
  expirationRate: { overall: number; trend: TrendPoint[] };
  topProducts: { mostQuoted: ProductRankingRow[]; mostConverted: ProductRankingRow[] };
  timeToFirstQuote: { overallSeconds: number; trend: TrendPoint[] };
};

const EMPTY_PREBUILT: PrebuiltReportsData = {
  bucketUnit: "day",
  quotesByPeriod: [],
  conversionBySeller: [],
  conversionBySource: [],
  conversionByBand: [],
  averageTicket: { overall: 0, trend: [] },
  expirationRate: { overall: 0, trend: [] },
  topProducts: { mostQuoted: [], mostConverted: [] },
  timeToFirstQuote: { overallSeconds: 0, trend: [] },
};

export async function getPrebuiltReportsData(period: ReportPeriod): Promise<PrebuiltReportsData> {
  const org = await getCurrentOrganization();
  if (!org) return EMPTY_PREBUILT;

  const filters = resolveReportFilters(period);
  const unit = bucketUnitForDays(periodDays(period));

  const [rows, itemRows] = await Promise.all([
    loadReportQuotes(org.id, filters),
    loadReportQuoteItems(org.id, filters),
  ]);

  const sellerIds = [
    ...new Set(rows.map((row) => row.owner_id).filter((id): id is string => !!id)),
  ];
  const sellerNames = await loadProfileNames(sellerIds);

  const quotesByPeriod = buildTrend(
    rows.map((row) => ({ created_at: row.created_at, value: 1 })),
    unit,
    (values) => sum(values),
  );

  const conversionBySeller = groupForConversion(
    rows,
    (row) => row.owner_id,
    (key) => sellerNames.get(key) ?? "Sem vendedor atribuído",
  );

  const conversionBySource = groupForConversion(
    rows,
    (row) => row.customer_source_id,
    (key) => getCustomerSource(key).name,
  );

  const emittedRows = rows.filter((row) => row.tax_snapshot_at !== null);

  const conversionByBand = groupForConversion(
    emittedRows,
    (row) => row.payment_band_label,
    (key) => key,
  );

  const ticketRows = emittedRows
    .filter((row) => row.total !== null)
    .map((row) => ({
      created_at: row.created_at,
      value: round2(new Decimal(row.total!)).toNumber(),
    }));
  const averageTicket = {
    overall: average(ticketRows.map((row) => row.value)),
    trend: buildTrend(ticketRows, unit, average),
  };

  const expirationRows = rows.map((row) => ({
    created_at: row.created_at,
    value: row.status === "expirado" ? 1 : 0,
  }));
  // `count` de cada ponto já é o total de orçamentos do bucket (um valor 0/1
  // por linha), não precisa de uma segunda passada — `value` é a média
  // desses 0/1, ou seja, a taxa de expiração do bucket.
  const expirationRate = {
    overall: average(expirationRows.map((row) => row.value)),
    trend: buildTrend(expirationRows, unit, average),
  };

  const durationRows = rows
    .filter(
      (row): row is ReportQuoteRow & { requested_at: string; delivered_at: string } =>
        row.customer_source_id === "site" && row.requested_at !== null && row.delivered_at !== null,
    )
    .map((row) => ({
      created_at: row.created_at,
      value: (new Date(row.delivered_at).getTime() - new Date(row.requested_at).getTime()) / 1000,
    }));
  const timeToFirstQuote = {
    overallSeconds: average(durationRows.map((row) => row.value)),
    trend: buildTrend(durationRows, unit, average),
  };

  const productMap = new Map<string, ProductRankingRow>();
  for (const item of itemRows) {
    const key = item.product_id ?? item.product_external_code;
    const status = Array.isArray(item.quotes) ? item.quotes[0]?.status : item.quotes?.status;
    const entry = productMap.get(key) ?? {
      productId: item.product_id,
      productExternalCode: item.product_external_code,
      productName: item.product_name,
      quotedCount: 0,
      quotedQuantity: 0,
      convertedCount: 0,
    };
    entry.quotedCount += 1;
    entry.quotedQuantity += Number(item.quantity);
    if (status === "convertido") entry.convertedCount += 1;
    productMap.set(key, entry);
  }
  const allProducts = [...productMap.values()];
  const topProducts = {
    mostQuoted: [...allProducts].sort((a, b) => b.quotedCount - a.quotedCount).slice(0, 10),
    mostConverted: [...allProducts]
      .filter((product) => product.convertedCount > 0)
      .sort((a, b) => b.convertedCount - a.convertedCount)
      .slice(0, 10),
  };

  return {
    bucketUnit: unit,
    quotesByPeriod,
    conversionBySeller,
    conversionBySource,
    conversionByBand,
    averageTicket,
    expirationRate,
    topProducts,
    timeToFirstQuote,
  };
}
