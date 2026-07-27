import { createClient } from "@/lib/supabase/server";
import type { PipelineActivity } from "@/lib/pipeline/mock-data";

/**
 * Timeline real do orçamento (Milestone 16), substituindo o mock da
 * Milestone 7 (`getQuoteActivitiesSync`). A RLS de `quote_activities` já
 * restringe a leitura a membro da organização do orçamento — não precisa
 * resolver a organização atual aqui, só o `quote_id`.
 */
export async function getQuoteActivities(quoteId: string): Promise<PipelineActivity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quote_activities")
    .select("id, type, label, detail, author_label, created_at")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    label: row.label,
    detail: row.detail ?? undefined,
    timestamp: row.created_at,
    author: row.author_label,
  }));
}
