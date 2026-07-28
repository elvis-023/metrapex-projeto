import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentOrganization } from "@/lib/auth/session";
import { getCustomerSource } from "@/lib/customers/mock-data";
import { formatQuoteNumber } from "@/lib/quotes/engine";
import { createClient } from "@/lib/supabase/server";
import { loadReportQuotes } from "@/lib/reports/queries";
import type { CustomReportFilters, ExportRawObject } from "@/lib/reports/types";
import type { Database } from "@/lib/supabase/types";

/**
 * Dado bruto filtrado, para exportação CSV/Excel (PLAN.md > Milestone 20) —
 * as mesmas linhas que alimentam os relatórios, sem agregação. Um fetcher por
 * objeto, reaproveitado pelos relatórios pré-construídos, pelo relatório
 * customizável e pelo anexo do envio agendado.
 *
 * Cada fetcher tem um núcleo `...Core` que recebe client + org_id prontos —
 * é o que `app/api/automations/send-reports/route.ts` chama diretamente,
 * porque aquele endpoint roda sem sessão de usuário (service_role, mesmo
 * modelo da Milestone 18) e não tem como `getCurrentOrganization()` resolver
 * organização nenhuma. As funções públicas (usadas pela UI) resolvem sessão
 * e client e delegam ao núcleo, para as duas pontas nunca divergirem.
 */

const statusLabels: Record<string, string> = {
  gerado: "Gerado",
  enviado: "Enviado",
  negociacao: "Em negociação",
  convertido: "Convertido",
  expirado: "Expirado",
};

export type RawQuoteRow = {
  number: string;
  customerName: string;
  sellerName: string;
  sourceLabel: string;
  status: string;
  bandLabel: string;
  total: number | null;
  createdAt: string;
  expiresAt: string | null;
};

export async function fetchRawQuotesCore(
  supabase: SupabaseClient<Database>,
  orgId: string,
  filters: CustomReportFilters,
): Promise<RawQuoteRow[]> {
  let rows = await loadReportQuotes(orgId, filters, supabase);
  if (filters.ownerId) rows = rows.filter((row) => row.owner_id === filters.ownerId);
  if (filters.sourceId) rows = rows.filter((row) => row.customer_source_id === filters.sourceId);

  const sellerIds = [
    ...new Set(rows.map((row) => row.owner_id).filter((id): id is string => !!id)),
  ];
  let sellerNames = new Map<string, string>();
  if (sellerIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", sellerIds);
    sellerNames = new Map((data ?? []).map((row) => [row.id, row.full_name]));
  }

  return rows.map((row) => ({
    number: formatQuoteNumber(row.sequence),
    customerName: row.customer_name,
    sellerName: row.owner_id ? (sellerNames.get(row.owner_id) ?? "—") : "Sem vendedor atribuído",
    sourceLabel: row.customer_source_id ? getCustomerSource(row.customer_source_id).name : "—",
    status: statusLabels[row.status] ?? row.status,
    bandLabel: row.payment_band_label ?? "—",
    total: row.total,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function fetchRawQuotes(filters: CustomReportFilters): Promise<RawQuoteRow[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];
  return fetchRawQuotesCore(await createClient(), org.id, filters);
}

export type RawQuoteItemRow = {
  quoteNumber: string;
  productCode: string;
  productName: string;
  categoryName: string;
  quantity: number;
  lineTotal: number | null;
};

export async function fetchRawQuoteItemsCore(
  supabase: SupabaseClient<Database>,
  orgId: string,
  filters: CustomReportFilters,
): Promise<RawQuoteItemRow[]> {
  let query = supabase
    .from("quote_items")
    .select(
      "product_external_code, product_name, category_name, quantity, line_total, " +
        "quotes!inner(sequence, org_id, superseded_by_revision_id, tax_snapshot_at, created_at, owner_id, customer_source_id)",
    )
    .eq("quotes.org_id", orgId)
    .is("quotes.superseded_by_revision_id", null)
    .not("quotes.tax_snapshot_at", "is", null)
    .gte("quotes.created_at", filters.from)
    .lte("quotes.created_at", filters.to);

  if (filters.ownerId) query = query.eq("quotes.owner_id", filters.ownerId);
  if (filters.sourceId) query = query.eq("quotes.customer_source_id", filters.sourceId);

  const { data } = await query.returns<
    {
      product_external_code: string;
      product_name: string;
      category_name: string | null;
      quantity: number;
      line_total: number | null;
      quotes: { sequence: number } | { sequence: number }[] | null;
    }[]
  >();

  return (data ?? []).map((row) => {
    const sequence = Array.isArray(row.quotes) ? row.quotes[0]?.sequence : row.quotes?.sequence;
    return {
      quoteNumber: sequence ? formatQuoteNumber(sequence) : "—",
      productCode: row.product_external_code,
      productName: row.product_name,
      categoryName: row.category_name ?? "Sem categoria",
      quantity: row.quantity,
      lineTotal: row.line_total,
    };
  });
}

export async function fetchRawQuoteItems(filters: CustomReportFilters): Promise<RawQuoteItemRow[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];
  return fetchRawQuoteItemsCore(await createClient(), org.id, filters);
}

export type RawCustomerRow = {
  name: string;
  document: string;
  email: string;
  phone: string;
  createdAt: string;
};

export async function fetchRawCustomersCore(
  supabase: SupabaseClient<Database>,
  orgId: string,
  filters: CustomReportFilters,
): Promise<RawCustomerRow[]> {
  const { data } = await supabase
    .from("customers")
    .select("name, document, email, phone, created_at")
    .eq("org_id", orgId)
    .gte("created_at", filters.from)
    .lte("created_at", filters.to);

  return (data ?? []).map((row) => ({
    name: row.name,
    document: row.document,
    email: row.email ?? "",
    phone: row.phone ?? "",
    createdAt: row.created_at,
  }));
}

export async function fetchRawCustomers(filters: CustomReportFilters): Promise<RawCustomerRow[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];
  return fetchRawCustomersCore(await createClient(), org.id, filters);
}

export async function fetchRawData(
  object: ExportRawObject,
  filters: CustomReportFilters,
): Promise<{ rows: unknown[]; kind: ExportRawObject }> {
  if (object === "quotes") return { rows: await fetchRawQuotes(filters), kind: object };
  if (object === "quote_items") return { rows: await fetchRawQuoteItems(filters), kind: object };
  return { rows: await fetchRawCustomers(filters), kind: object };
}

/** Variante service_role (org_id explícito) — usada pelo job de envio agendado. */
export async function fetchRawDataCore(
  supabase: SupabaseClient<Database>,
  orgId: string,
  object: ExportRawObject,
  filters: CustomReportFilters,
): Promise<{ rows: unknown[]; kind: ExportRawObject }> {
  if (object === "quotes")
    return { rows: await fetchRawQuotesCore(supabase, orgId, filters), kind: object };
  if (object === "quote_items") {
    return { rows: await fetchRawQuoteItemsCore(supabase, orgId, filters), kind: object };
  }
  return { rows: await fetchRawCustomersCore(supabase, orgId, filters), kind: object };
}
