import { fetchCnpjData } from "@/lib/integrations/brasil-api";
import type { TaxRegime } from "@/lib/tax-engine/onboarding-templates";

/**
 * Bloco 7 — serviço de detecção de regime tributário a partir do CNPJ do
 * passo 1 do onboarding. Três estados, nunca um quarto: "mei" e
 * "simples_nacional" são as duas únicas sugestões automáticas que o produto
 * oferece — Lucro Presumido e Lucro Real nunca saem daqui, continuam exigindo
 * escolha manual no passo 2 (decisão "Regime Tributário" #4–#8 em
 * .claude/skills/decisao-pendente/references/decisoes-registradas.md).
 */
export type CnpjRegimeDetection = Extract<TaxRegime, "mei" | "simples_nacional"> | "nao_detectado";

/**
 * Cache em memória por processo, chaveado pelo CNPJ (só dígitos) — evita
 * reconsultar a BrasilAPI a cada tecla digitada ou toda vez que o usuário
 * volta ao passo 1 sem mudar o CNPJ. Best-effort: não sobrevive a reinício
 * do processo nem é compartilhado entre instâncias em deploy multi-instância
 * — aceitável porque é só uma sugestão de UX, não um dado que precisa estar
 * sempre fresco. Falha da API também é cacheada pelo mesmo TTL (evita bater
 * repetidamente numa API fora do ar), tradeoff aceitável dado o TTL curto.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { result: CnpjRegimeDetection; expiresAt: number }>();

function fromCache(cnpjDigits: string): CnpjRegimeDetection | undefined {
  const entry = cache.get(cnpjDigits);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(cnpjDigits);
    return undefined;
  }
  return entry.result;
}

function toCache(cnpjDigits: string, result: CnpjRegimeDetection): void {
  cache.set(cnpjDigits, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Mapeia os campos fiscais crus (nuláveis, decisão "Regime Tributário" #5)
 * pro resultado de três estados. Usa só o status ATUAL da opção — pedido
 * explícito do usuário: `data_exclusao_do_mei`/`data_exclusao_do_simples`
 * (histórico de quando a empresa foi excluída) não entram nesta regra, só
 * o booleano corrente. MEI é checado primeiro por ser o regime mais
 * específico dos dois (SIMEI é um subconjunto do Simples com regras
 * próprias — não confundir os dois campos).
 */
export function classifyCnpjRegime(input: {
  opcaoPeloMei: boolean | null;
  opcaoPeloSimples: boolean | null;
}): CnpjRegimeDetection {
  if (input.opcaoPeloMei === true) return "mei";
  if (input.opcaoPeloSimples === true) return "simples_nacional";
  return "nao_detectado";
}

/**
 * Serviço de detecção de regime por CNPJ. Nunca lança — qualquer falha
 * (rede, timeout, CNPJ não encontrado) é logada e vira `"nao_detectado"`,
 * nunca `undefined` nem exceção não tratada: o passo 1 do onboarding não
 * pode travar por causa de uma API de terceiro indisponível (decisão
 * "Regime Tributário" #7). Único consumo de `fetchCnpjData` para fins de
 * detecção — o gatilho que chama esta função a partir do campo de texto do
 * passo 1 (contagem de dígitos, debounce) é o Bloco 8, ainda não escrito.
 */
export async function detectRegimeFromCnpj(cnpjDigits: string): Promise<CnpjRegimeDetection> {
  const cached = fromCache(cnpjDigits);
  if (cached !== undefined) return cached;

  try {
    const { opcaoPeloMei, opcaoPeloSimples } = await fetchCnpjData(cnpjDigits);
    const result = classifyCnpjRegime({ opcaoPeloMei, opcaoPeloSimples });
    toCache(cnpjDigits, result);
    return result;
  } catch (error) {
    console.error(
      "[regime-detection] falha ao consultar a BrasilAPI para detecção automática de regime:",
      error,
    );
    toCache(cnpjDigits, "nao_detectado");
    return "nao_detectado";
  }
}
