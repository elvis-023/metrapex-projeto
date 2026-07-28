import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * Client de service_role para os dois endpoints de automação (Milestone
 * 18) — nenhuma sessão de usuário aqui (chamador é o n8n), então RLS não
 * protege ninguém e este client bypassa tudo. Compartilhado só entre
 * `app/api/automations/*`, não exportado do módulo `lib/automations` como
 * um todo, mesma disciplina do client isolado em `app/api/public-quote/route.ts`.
 */
export function createAutomationsServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role não configurado.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
