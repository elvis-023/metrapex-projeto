import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { fetchCnpjData } from "@/lib/integrations/brasil-api";

/**
 * Client de service_role isolado a este route handler — só usado aqui para
 * o rate limit por IP (a consulta em si é BrasilAPI, sem RLS envolvido).
 * Não exportado de propósito, mesmo motivo de app/api/public-quote/route.ts.
 */
function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role não configurado.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Generoso (comparado ao rate limit do envio): esta rota é chamada enquanto
// o visitante ainda está digitando, antes de qualquer Turnstile/honeypot —
// o objetivo é só impedir que o servidor vire um proxy anônimo para a
// BrasilAPI, não travar o preenchimento legítimo do formulário.
const RATE_LIMIT = { scope: "lookup-cnpj-ip", windowSeconds: 600, limit: 30 };

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const cnpjDigits = onlyDigits(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (cnpjDigits.length !== 14) {
    return NextResponse.json({ error: "CNPJ deve ter 14 dígitos." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ip = clientIp(request);
  const { data: withinLimit } = await supabase.rpc("public_form_check_rate_limit", {
    p_scope: RATE_LIMIT.scope,
    p_key: ip,
    p_window_seconds: RATE_LIMIT.windowSeconds,
    p_limit: RATE_LIMIT.limit,
  });
  if (withinLimit === false) {
    return NextResponse.json(
      { error: "Muitas consultas. Tente novamente em instantes." },
      { status: 429 },
    );
  }

  // A rota pública só expõe legalName+address ao visitante anônimo — os
  // campos fiscais que `fetchCnpjData` também devolve (porte, opção pelo
  // MEI/Simples) são de uso exclusivo da detecção de regime do onboarding
  // autenticado (lib/tax-engine/actions.ts), nunca deste contrato.
  try {
    const { legalName, address } = await fetchCnpjData(cnpjDigits);
    return NextResponse.json({ legalName, address });
  } catch {
    return NextResponse.json({ error: "CNPJ não encontrado." }, { status: 404 });
  }
}
