import Decimal from "decimal.js";

import { getCurrentOrganization } from "@/lib/auth/session";
import { getCustomerSource } from "@/lib/customers/mock-data";
import { round2 } from "@/lib/quotes/engine";
import { createClient } from "@/lib/supabase/server";
import { bucketKey, bucketLabel } from "@/lib/reports/format";
import { loadReportQuotes, type ReportQuoteRow } from "@/lib/reports/queries";
import {
  customMetricOptions,
  validateCustomReportSpec,
  type CustomReportResult,
  type CustomReportSpec,
} from "@/lib/reports/types";

const statusLabels: Record<string, string> = {
  gerado: "Gerado",
  enviado: "Enviado",
  negociacao: "Em negociação",
  convertido: "Convertido",
  expirado: "Expirado",
};

function metricLabel(spec: CustomReportSpec): string {
  const base = customMetricOptions.find((option) => option.value === spec.metric)?.label ?? "";
  if (spec.metric === "count") return base;
  return `${base} do valor`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function applyMetric(metric: CustomReportSpec["metric"], entries: number[], count: number): number {
  if (metric === "count") return count;
  if (metric === "sum") return round2(new Decimal(sum(entries))).toNumber();
  return entries.length === 0
    ? 0
    : round2(new Decimal(sum(entries)).div(entries.length)).toNumber();
}

type Bucket = { count: number; values: number[] };

function aggregate(
  rows: { key: string | null; label: string; value: number }[],
  metric: CustomReportSpec["metric"],
): { key: string; label: string; value: number }[] {
  const buckets = new Map<string, { label: string } & Bucket>();
  for (const row of rows) {
    const key = row.key ?? "—";
    const bucket = buckets.get(key) ?? { label: row.label, count: 0, values: [] };
    bucket.count += 1;
    bucket.values.push(row.value);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      value: applyMetric(metric, bucket.values, bucket.count),
    }))
    .sort((a, b) => b.value - a.value);
}

function quoteGroupKey(
  row: ReportQuoteRow,
  groupBy: CustomReportSpec["groupBy"],
  unit: "day" | "week" | "month" | null,
): { key: string | null; label: string } {
  switch (groupBy) {
    case "status":
      return { key: row.status, label: statusLabels[row.status] ?? row.status };
    case "seller":
      return { key: row.owner_id, label: row.owner_id ?? "Sem vendedor atribuído" };
    case "source":
      return {
        key: row.customer_source_id,
        label: row.customer_source_id ? getCustomerSource(row.customer_source_id).name : "—",
      };
    case "band":
      return { key: row.payment_band_label, label: row.payment_band_label ?? "—" };
    case "period_day":
    case "period_week":
    case "period_month": {
      const key = bucketKey(new Date(row.created_at), unit!);
      return { key, label: bucketLabel(key, unit!) };
    }
    default:
      return { key: "total", label: "Total" };
  }
}

async function runQuotesReport(orgId: string, spec: CustomReportSpec): Promise<CustomReportResult> {
  let rows = await loadReportQuotes(orgId, spec.filters);
  if (spec.filters.ownerId) rows = rows.filter((row) => row.owner_id === spec.filters.ownerId);
  if (spec.filters.sourceId) {
    rows = rows.filter((row) => row.customer_source_id === spec.filters.sourceId);
  }
  // sum/average só fazem sentido sobre valor emitido — mesmo motivo de
  // conversionByBand/averageTicket em queries.ts.
  const valueRows = spec.metric === "count" ? rows : rows.filter((row) => row.total !== null);

  const unit =
    spec.groupBy === "period_day" ? "day" : spec.groupBy === "period_week" ? "week" : "month";

  // Resolve o vendedor a nome antes de agregar, quando agrupando por vendedor.
  let sellerNames = new Map<string, string>();
  if (spec.groupBy === "seller") {
    const ids = [...new Set(rows.map((row) => row.owner_id).filter((id): id is string => !!id))];
    if (ids.length > 0) {
      const supabase = await createClient();
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      sellerNames = new Map((data ?? []).map((row) => [row.id, row.full_name]));
    }
  }

  const grouped = valueRows.map((row) => {
    const { key, label } = quoteGroupKey(row, spec.groupBy, unit);
    const resolvedLabel =
      spec.groupBy === "seller" && key ? (sellerNames.get(key) ?? "Sem vendedor atribuído") : label;
    return {
      key,
      label: resolvedLabel,
      value: row.total !== null ? round2(new Decimal(row.total)).toNumber() : 0,
    };
  });

  return { groups: aggregate(grouped, spec.metric), metricLabel: metricLabel(spec) };
}

async function runQuoteItemsReport(
  orgId: string,
  spec: CustomReportSpec,
): Promise<CustomReportResult> {
  const supabase = await createClient();
  let query = supabase
    .from("quote_items")
    .select(
      "product_id, product_external_code, product_name, category_id_snapshot, category_name, line_total, " +
        "quotes!inner(org_id, superseded_by_revision_id, tax_snapshot_at, created_at, owner_id, customer_source_id)",
    )
    .eq("quotes.org_id", orgId)
    .is("quotes.superseded_by_revision_id", null)
    .not("quotes.tax_snapshot_at", "is", null)
    .gte("quotes.created_at", spec.filters.from)
    .lte("quotes.created_at", spec.filters.to);

  if (spec.filters.ownerId) query = query.eq("quotes.owner_id", spec.filters.ownerId);
  if (spec.filters.sourceId) query = query.eq("quotes.customer_source_id", spec.filters.sourceId);

  const { data } = await query.returns<
    {
      product_id: string | null;
      product_external_code: string;
      product_name: string;
      category_id_snapshot: string | null;
      category_name: string | null;
      line_total: number | null;
    }[]
  >();

  const rows = data ?? [];
  const grouped = rows.map((row) => {
    const key =
      spec.groupBy === "category"
        ? (row.category_id_snapshot ?? "—")
        : (row.product_id ?? row.product_external_code);
    const label =
      spec.groupBy === "category" ? (row.category_name ?? "Sem categoria") : row.product_name;
    return {
      key: spec.groupBy === "none" ? "total" : key,
      label: spec.groupBy === "none" ? "Total" : label,
      value: row.line_total !== null ? round2(new Decimal(row.line_total)).toNumber() : 0,
    };
  });

  return { groups: aggregate(grouped, spec.metric), metricLabel: metricLabel(spec) };
}

async function runCustomersReport(
  orgId: string,
  spec: CustomReportSpec,
): Promise<CustomReportResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, document, created_at")
    .eq("org_id", orgId)
    .gte("created_at", spec.filters.from)
    .lte("created_at", spec.filters.to);

  const rows = (data ?? []).map((row) => {
    const isCompany = row.document.length === 14;
    const key = spec.groupBy === "document_type" ? (isCompany ? "pj" : "pf") : "total";
    const label =
      spec.groupBy === "document_type"
        ? isCompany
          ? "Pessoa jurídica"
          : "Pessoa física"
        : "Total";
    return { key, label, value: 1 };
  });

  return { groups: aggregate(rows, "count"), metricLabel: metricLabel(spec) };
}

export async function runCustomReport(spec: CustomReportSpec): Promise<CustomReportResult> {
  const validationError = validateCustomReportSpec(spec);
  if (validationError) throw new Error(validationError);

  const org = await getCurrentOrganization();
  if (!org) return { groups: [], metricLabel: metricLabel(spec) };

  if (spec.object === "quotes") return runQuotesReport(org.id, spec);
  if (spec.object === "quote_items") return runQuoteItemsReport(org.id, spec);
  return runCustomersReport(org.id, spec);
}
