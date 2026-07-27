"use server";

import { revalidatePath } from "next/cache";

import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { QuoteStatus } from "@/lib/supabase/types";

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

/**
 * Persiste a etapa arrastada no board. A regra "só dono ou admin move o
 * card" NÃO é aplicada aqui — é o trigger `quotes_guard_stage_permission` e a
 * RLS de `quote_activities` (migration 20260727000011_pipeline_backend.sql)
 * que recusam a escrita no banco. Esta action só repassa o erro do RPC para
 * a UI reverter o card e avisar o vendedor.
 */
export async function moveQuoteStageAction(quoteId: string, status: QuoteStatus): Promise<void> {
  await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.rpc("move_quote_stage", {
    p_quote_id: quoteId,
    p_status: status,
  });

  if (error) throw new Error(error.message || "Não foi possível mover o orçamento.");

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${quoteId}`);
  revalidatePath("/dashboard");
}

/** Mesma regra de permissão de `moveQuoteStageAction`, aplicada por `add_quote_note`. */
export async function addQuoteNoteAction(quoteId: string, detail: string): Promise<void> {
  await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.rpc("add_quote_note", {
    p_quote_id: quoteId,
    p_detail: detail,
  });

  if (error) throw new Error(error.message || "Não foi possível adicionar a nota.");

  revalidatePath(`/pipeline/${quoteId}`);
}
