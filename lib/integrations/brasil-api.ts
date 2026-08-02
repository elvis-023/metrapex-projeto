import type { PublicFormAddress } from "@/lib/public-form/types";

/**
 * Client compartilhado da consulta de CNPJ via BrasilAPI — usado pela rota
 * pública do formulário (app/api/public-quote/lookup-cnpj) e pela detecção
 * de regime tributário do onboarding autenticado (lib/tax-engine/actions.ts).
 * Os dois consumidores têm contratos diferentes (a rota pública expõe só
 * legalName+address pro visitante anônimo; o onboarding também precisa dos
 * campos fiscais) — ver decisão "Regime Tributário #4" em
 * .claude/skills/decisao-pendente/references/decisoes-registradas.md.
 */

/**
 * Campos crus da resposta da BrasilAPI (`GET /api/cnpj/v1/{cnpj}`), na
 * nomenclatura original da API. `opcao_pelo_mei`/`opcao_pelo_simples` vêm
 * `null` (não `false`) quando a empresa nunca optou — confirmado por chamada
 * real (Petrobras, CNPJ 33.000.167/0001-01, decisão "Regime Tributário #5").
 * O caso positivo (`true`) ainda não foi confirmado contra dado real.
 */
export type BrasilApiCnpjResponse = {
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
  porte?: string | null;
  codigo_porte?: number | null;
  opcao_pelo_mei?: boolean | null;
  data_opcao_pelo_mei?: string | null;
  data_exclusao_do_mei?: string | null;
  opcao_pelo_simples?: boolean | null;
  data_opcao_pelo_simples?: string | null;
  data_exclusao_do_simples?: string | null;
  message?: string;
};

export type BrasilApiCnpjResult = {
  legalName: string;
  address: PublicFormAddress;
  porte: string | null;
  codigoPorte: number | null;
  opcaoPeloMei: boolean | null;
  opcaoPeloSimples: boolean | null;
};

/**
 * Valor inicial conservador para `AbortSignal.timeout` — a detecção de
 * regime do onboarding (lib/tax-engine/regime-detection.ts) nunca pode
 * travar o avanço do wizard esperando a BrasilAPI (decisão "Regime
 * Tributário" #7). Número exato a revisar depois; exportado para não ficar
 * um "magic number" duplicado entre este arquivo e quem documenta o
 * comportamento de timeout.
 */
export const CNPJ_LOOKUP_TIMEOUT_MS = 4000;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Exportado também para o teste da rota pública (route.test.ts) — a
// BrasilAPI devolve o tipo de logradouro separado do nome, e essa junção já
// foi esquecida uma vez.
export function formatStreet(
  tipoLogradouro: string | undefined,
  logradouro: string | undefined,
): string {
  return [tipoLogradouro?.trim(), logradouro?.trim()].filter(Boolean).join(" ");
}

/**
 * Consulta a BrasilAPI diretamente (server-side). Lança em qualquer falha
 * (`!response.ok`, rede ou timeout) — mesmo padrão de
 * `lib/integrations/turnstile.ts`/`pdfmonkey.ts`, sem wrapper `{ok, data}`.
 *
 * `AbortSignal.timeout` é um padrão novo neste projeto (nenhuma outra
 * chamada externa tem timeout explícito hoje) — necessário aqui porque a
 * detecção de regime do onboarding nunca pode travar o avanço do wizard
 * esperando uma API de terceiro (decisão "Regime Tributário #7").
 */
export async function fetchCnpjData(cnpjDigits: string): Promise<BrasilApiCnpjResult> {
  // BrasilAPI recusa (403) requisições sem User-Agent — o default do fetch
  // do Node não basta, precisa de um valor explícito.
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
    headers: { "User-Agent": "metrapex-app/1.0" },
    signal: AbortSignal.timeout(CNPJ_LOOKUP_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`BrasilAPI respondeu ${response.status} para o CNPJ consultado.`);
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

  return {
    legalName: data.razao_social ?? data.nome_fantasia ?? "",
    address,
    porte: data.porte ?? null,
    codigoPorte: data.codigo_porte ?? null,
    opcaoPeloMei: data.opcao_pelo_mei ?? null,
    opcaoPeloSimples: data.opcao_pelo_simples ?? null,
  };
}
