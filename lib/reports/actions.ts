"use server";

import { revalidatePath } from "next/cache";

import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { runCustomReport } from "@/lib/reports/custom";
import { buildRawExportFile } from "@/lib/reports/export-columns";
import { fetchRawData } from "@/lib/reports/raw";
import type {
  CustomReportFilters,
  CustomReportResult,
  CustomReportSpec,
  ExportedFile,
  ExportFormat,
  ExportRawObject,
} from "@/lib/reports/types";
import type { ReportFrequency } from "@/lib/supabase/types";

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

const rawFilenameByObject: Record<ExportRawObject, string> = {
  quotes: "orcamentos",
  quote_items: "itens-de-orcamento",
  customers: "clientes",
};

export async function exportRawDataAction(
  object: ExportRawObject,
  filters: CustomReportFilters,
  format: ExportFormat,
): Promise<ExportedFile> {
  await requireOrg();
  const { rows } = await fetchRawData(object, filters);
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `${rawFilenameByObject[object]}-${datePart}.${format}`;
  const { base64, mimeType } = buildRawExportFile(object, rows, format);
  return { filename, base64, mimeType };
}

export async function runCustomReportAction(spec: CustomReportSpec): Promise<CustomReportResult> {
  await requireOrg();
  return runCustomReport(spec);
}

// ---------------------------------------------------------------------------
// Envio agendado — CRUD de report_schedules (RLS: select member, write admin).
// ---------------------------------------------------------------------------

export type ReportScheduleActionInput = {
  name: string;
  reportKey: string;
  definition: Record<string, unknown>;
  frequency: ReportFrequency;
  recipients: string[];
};

function parseScheduleInput(input: ReportScheduleActionInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Nome do agendamento obrigatório.");

  const recipients = input.recipients.map((email) => email.trim()).filter(Boolean);
  if (recipients.length === 0) throw new Error("Informe ao menos um destinatário.");
  const invalid = recipients.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid) throw new Error(`E-mail inválido: ${invalid}`);

  return { name, recipients };
}

export async function createReportScheduleAction(
  input: ReportScheduleActionInput,
): Promise<{ id: string }> {
  const org = await requireOrg();
  const { name, recipients } = parseScheduleInput(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("report_schedules")
    .insert({
      org_id: org.id,
      name,
      report_key: input.reportKey,
      definition: input.definition,
      frequency: input.frequency,
      recipients,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Não foi possível criar o agendamento.");

  revalidatePath("/reports/schedules");
  return { id: data.id };
}

export async function updateReportScheduleAction(
  id: string,
  input: ReportScheduleActionInput,
): Promise<void> {
  await requireOrg();
  const { name, recipients } = parseScheduleInput(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("report_schedules")
    .update({ name, definition: input.definition, frequency: input.frequency, recipients })
    .eq("id", id);

  if (error) throw new Error("Não foi possível salvar o agendamento.");
  revalidatePath("/reports/schedules");
}

export async function toggleReportScheduleAction(id: string, active: boolean): Promise<void> {
  await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("report_schedules")
    .update({ active, ...(active ? { next_run_at: new Date().toISOString() } : {}) })
    .eq("id", id);

  if (error) throw new Error("Não foi possível atualizar o agendamento.");
  revalidatePath("/reports/schedules");
}

export async function deleteReportScheduleAction(id: string): Promise<void> {
  await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase.from("report_schedules").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o agendamento.");
  revalidatePath("/reports/schedules");
}
