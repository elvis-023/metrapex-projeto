import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type { PublicFormAddress } from "@/lib/public-form/types";

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

type BrasilApiCnpjResponse = {
  razao_social?: string;
  nome_fantasia?: string;
  cep?: string;
  // BrasilAPI separa o tipo do logradouro ("AVENIDA") do nome ("REPUBLICA DO
  // CHILE") em dois campos — usar só `logradouro` perde o "Rua"/"Avenida"/etc.
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  message?: string;
};

// Exportado só para o teste (route.test.ts) — a BrasilAPI devolve o tipo de
// logradouro separado do nome, e essa junção já foi esquecida uma vez.
export function formatStreet(
  tipoLogradouro: string | undefined,
  logradouro: string | undefined,
): string {
  return [tipoLogradouro?.trim(), logradouro?.trim()].filter(Boolean).join(" ");
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

  // BrasilAPI recusa (403) requisições sem User-Agent — o default do fetch
  // do Node não basta, precisa de um valor explícito.
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
    headers: { "User-Agent": "metrapex-formulario-publico/1.0" },
  });
  if (!response.ok) {
    return NextResponse.json({ error: "CNPJ não encontrado." }, { status: 404 });
  }

  const data = (await response.json()) as BrasilApiCnpjResponse;

  const address: PublicFormAddress = {
    zip: onlyDigits(data.cep ?? ""),
    street: formatStreet(data.descricao_tipo_de_logradouro, data.logradouro),
    number: data.numero ?? "",
    complement: data.complemento ?? "",
    neighborhood: data.bairro ?? "",
    city: data.municipio ?? "",
    state: data.uf ?? "",
  };

  return NextResponse.json({
    legalName: data.razao_social ?? data.nome_fantasia ?? "",
    address,
  });
}
