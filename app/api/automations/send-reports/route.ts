import Decimal from "decimal.js";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyAutomationSecret } from "@/lib/automations/auth";
import { createAutomationsServiceClient } from "@/lib/automations/service-client";
import { sendReportEmail } from "@/lib/integrations/resend";
import { round2 } from "@/lib/quotes/engine";
import { buildRawExportFile } from "@/lib/reports/export-columns";
import { loadReportQuotes } from "@/lib/reports/queries";
import { fetchRawDataCore } from "@/lib/reports/raw";
import { currencyFormatter, formatRate } from "@/lib/dashboard/format";
import {
  frequencyLookbackDays,
  nextRunAtFor,
  prebuiltReportLabel,
  type CustomReportFilters,
  type ExportRawObject,
} from "@/lib/reports/types";
import type { Database } from "@/lib/supabase/types";

/**
 * Envio agendado de relatório por e-mail (PLAN.md > Milestone 20). Mesmo
 * modelo de chamada máquina-a-máquina da Milestone 18: n8n dispara este
 * endpoint uma vez por dia (docs/n8n/milestone-20-reports.workflow.json),
 * autenticado por `AUTOMATIONS_API_SECRET`, e o backend decide QUAIS
 * agendamentos estão de fato vencidos (`report_schedules_due`) — n8n só
 * agenda o disparo diário, nunca decide o quê enviar (CLAUDE.md).
 *
 * Um agendamento "diário"/"semanal"/"mensal" não guarda de/até: a janela do
 * relatório enviado é sempre "os últimos N dias" a partir de agora, N vindo
 * da frequência (frequencyLookbackDays) — mesma simplificação assumida em
 * `lib/reports/schedules.ts`.
 */

const JOB_NAME = "send_reports";
const CLAIM_WINDOW_SECONDS = 3600;

type SendReportsSummary = { checked: number; sent: number; errors: string[] };

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

function rawObjectFor(reportKey: string, definition: Record<string, unknown>): ExportRawObject {
  if (reportKey === "top_products") return "quote_items";
  if (reportKey === "custom") {
    const object = definition.object;
    if (object === "quote_items" || object === "customers") return object;
    return "quotes";
  }
  return "quotes";
}

async function buildSummaryRows(
  supabase: SupabaseClient<Database>,
  object: ExportRawObject,
  orgId: string,
  filters: CustomReportFilters,
  itemCount: number,
): Promise<{ label: string; value: string }[]> {
  if (object === "quotes") {
    const quotes = await loadReportQuotes(orgId, filters, supabase);
    const converted = quotes.filter((row) => row.status === "convertido").length;
    const emittedTotals = quotes
      .filter((row) => row.tax_snapshot_at !== null && row.total !== null)
      .map((row) => round2(new Decimal(row.total!)).toNumber());
    const sumTotal = emittedTotals.reduce((total, value) => total + value, 0);
    return [
      { label: "Total de orçamentos", value: String(quotes.length) },
      { label: "Convertidos", value: String(converted) },
      {
        label: "Taxa de conversão",
        value: formatRate(quotes.length === 0 ? 0 : converted / quotes.length),
      },
      { label: "Valor total emitido", value: currencyFormatter.format(sumTotal) },
    ];
  }
  if (object === "quote_items") {
    return [{ label: "Total de itens de orçamento", value: String(itemCount) }];
  }
  return [{ label: "Total de clientes cadastrados", value: String(itemCount) }];
}

export async function POST(request: NextRequest) {
  if (!verifyAutomationSecret(request)) return unauthorized();

  const supabase = createAutomationsServiceClient();

  const { data: claim, error: claimError } = await supabase
    .rpc("automation_claim_run", { p_job_name: JOB_NAME, p_window_seconds: CLAIM_WINDOW_SECONDS })
    .maybeSingle();

  if (claimError || !claim) {
    console.error("[automations/send-reports] falha ao reivindicar execução", claimError);
    return NextResponse.json({ error: "Falha ao iniciar job." }, { status: 500 });
  }

  if (!claim.claimed) {
    return NextResponse.json(
      { skipped: true, reason: claim.status, summary: claim.summary },
      { status: 409 },
    );
  }

  const summary: SendReportsSummary = { checked: 0, sent: 0, errors: [] };

  try {
    const { data: dueSchedules, error: dueError } = await supabase.rpc("report_schedules_due");
    if (dueError) throw dueError;

    summary.checked = dueSchedules?.length ?? 0;

    for (const schedule of dueSchedules ?? []) {
      try {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", schedule.org_id)
          .single();

        const lookbackDays = frequencyLookbackDays[schedule.frequency];
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - lookbackDays);
        const filters: CustomReportFilters = { from: from.toISOString(), to: to.toISOString() };
        const definition = (schedule.definition ?? {}) as Record<string, unknown>;
        if (typeof definition.ownerId === "string") filters.ownerId = definition.ownerId;
        if (typeof definition.sourceId === "string") filters.sourceId = definition.sourceId;

        const object = rawObjectFor(schedule.report_key, definition);
        const { rows } = await fetchRawDataCore(supabase, schedule.org_id, object, filters);
        const { base64 } = buildRawExportFile(object, rows, "csv");
        const summaryRows = await buildSummaryRows(
          supabase,
          object,
          schedule.org_id,
          filters,
          rows.length,
        );

        await sendReportEmail({
          to: schedule.recipients,
          organizationName: org?.name ?? "Metrapex",
          scheduleName: schedule.name || prebuiltReportLabel(schedule.report_key),
          periodLabel: `últimos ${lookbackDays} dia(s)`,
          summaryRows,
          attachment: { filename: `relatorio-${schedule.id}.csv`, base64 },
        });

        await supabase.rpc("report_schedules_mark_sent", {
          p_id: schedule.id,
          p_next_run_at: nextRunAtFor(schedule.frequency),
        });
        summary.sent += 1;
      } catch (error) {
        summary.errors.push(`${schedule.id}: ${(error as Error).message}`);
        continue;
      }
    }

    await supabase.rpc("automation_complete_run", {
      p_job_name: JOB_NAME,
      p_window_bucket: claim.run_window,
      p_summary: summary,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[automations/send-reports] falha", error);
    await supabase.rpc("automation_fail_run", {
      p_job_name: JOB_NAME,
      p_window_bucket: claim.run_window,
      p_error: (error as Error).message,
    });
    return NextResponse.json({ error: "Falha ao executar job." }, { status: 500 });
  }
}
