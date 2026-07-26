import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type { PublicFormAddress } from "@/lib/public-form/types";

/** Ver app/api/public-quote/lookup-cnpj/route.ts — mesmo raciocínio de isolamento. */
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

const RATE_LIMIT = { scope: "lookup-cep-ip", windowSeconds: 600, limit: 30 };

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function GET(request: NextRequest) {
  const cepDigits = onlyDigits(request.nextUrl.searchParams.get("cep") ?? "");
  if (cepDigits.length !== 8) {
    return NextResponse.json({ error: "CEP deve ter 8 dígitos." }, { status: 400 });
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
    return NextResponse.json({ error: "Muitas consultas. Tente novamente em instantes." }, { status: 429 });
  }

  const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
    headers: { "User-Agent": "metrapex-formulario-publico/1.0" },
  });
  if (!response.ok) {
    return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
  }

  const data = (await response.json()) as ViaCepResponse;
  if (data.erro) {
    return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
  }

  const address: PublicFormAddress = {
    zip: onlyDigits(data.cep ?? cepDigits),
    street: data.logradouro ?? "",
    number: "",
    complement: data.complemento ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };

  return NextResponse.json(address);
}
