import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ReportSchedule } from "@/lib/reports/types";

/** Todo membro lê os agendamentos (transparência sobre quem recebe o quê) — só admin cria/edita/exclui. */
export async function getReportSchedules(): Promise<ReportSchedule[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_schedules")
    .select(
      "id, name, report_key, definition, frequency, recipients, active, next_run_at, last_sent_at",
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    reportKey: row.report_key,
    definition: row.definition,
    frequency: row.frequency,
    recipients: row.recipients,
    active: row.active,
    nextRunAt: row.next_run_at,
    lastSentAt: row.last_sent_at,
  }));
}
