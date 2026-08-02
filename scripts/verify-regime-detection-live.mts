/**
 * Verificação ao vivo do serviço de detecção de regime por CNPJ
 * (lib/tax-engine/regime-detection.ts) contra a BrasilAPI real — não mocka
 * `fetch`, só instrumenta pra contar chamadas (cache) ou travar a resposta
 * (timeout). Cobre os casos que dá pra provar sem CNPJ de categoria
 * específica (MEI/Simples ativos, Simples excluído continuam pendentes de
 * CNPJ real fornecido pelo usuário — ver relatório impresso no fim).
 *
 * Uso: `npx tsx scripts/verify-regime-detection-live.mts`
 */
import { detectRegimeFromCnpj } from "@/lib/tax-engine/regime-detection";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail)}`);
  }
}

const originalFetch = globalThis.fetch;

async function main() {
  console.log("\n== Caso 4: empresas reais NÃO optantes (Lucro Presumido/Real) ==");
  console.log("   Petrobras (33.000.167/0001-01) — Lucro Real, confirmado antes nesta conversa");
  const petrobras = await detectRegimeFromCnpj("33000167000101");
  check('Petrobras → "nao_detectado" (nunca chuta um regime)', petrobras === "nao_detectado", {
    got: petrobras,
  });

  console.log(
    "   Open Knowledge Brasil (19.131.243/0001-97) — associação, isenta de IRPJ, CNPJ de teste oficial da própria BrasilAPI (tests/cnpj-v1.test.js)",
  );
  const okbr = await detectRegimeFromCnpj("19131243000197");
  check('Open Knowledge Brasil → "nao_detectado"', okbr === "nao_detectado", { got: okbr });

  console.log("\n== Caso 5: timeout derrubando a chamada de propósito ==");
  // Substitui o fetch global por uma chamada que nunca resolve sozinha —
  // mas RESPEITA o `signal` recebido, exatamente como o fetch real faria,
  // pra quem de fato aborta a chamada seja o AbortSignal.timeout(4000) de
  // dentro de fetchCnpjData, não um atalho deste script.
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason));
      }
    })) as typeof fetch;
  const timeoutStart = Date.now();
  let timeoutThrew = false;
  let timeoutResult: string | null = null;
  try {
    timeoutResult = await Promise.race([
      detectRegimeFromCnpj("00000000000191"), // CNPJ inexistente, fora do cache — nunca sai da rede de verdade (fetch está substituído acima)
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("safety-net: script travou além de 8s")), 8000),
      ),
    ]);
  } catch {
    timeoutThrew = true;
  }
  const timeoutElapsedMs = Date.now() - timeoutStart;
  globalThis.fetch = originalFetch;
  check("timeout NÃO lança exceção (tela não quebra)", !timeoutThrew);
  check('timeout devolve "nao_detectado", não undefined/null', timeoutResult === "nao_detectado", {
    got: timeoutResult,
  });
  check(
    `abortou perto dos 4000ms configurados (levou ${timeoutElapsedMs}ms)`,
    timeoutElapsedMs >= 3900 && timeoutElapsedMs <= 6000,
    { timeoutElapsedMs },
  );

  console.log(
    "\n== Caso 6: mesma consulta várias vezes seguidas — cache evita chamada repetida ==",
  );
  let realFetchCalls = 0;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    realFetchCalls += 1;
    return originalFetch(...args);
  }) as typeof fetch;

  const cnpjParaCache = "33000167000101"; // Petrobras de novo — mesmo CNPJ do Caso 4
  const results: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    results.push(await detectRegimeFromCnpj(cnpjParaCache));
  }
  globalThis.fetch = originalFetch;

  console.log(
    `  (${realFetchCalls} chamada(s) HTTP real(is) nestas 5 consultas — 0 é esperado aqui: ` +
      "este CNPJ já tinha sido consultado no Caso 4, dentro do TTL de 5min, então até a " +
      "1ª chamada deste bloco já veio do cache. Prova mais forte de cache, não mais fraca.)",
  );
  check("5 chamadas seguidas devolvem o mesmo resultado", new Set(results).size === 1, results);
  check(
    "no máximo 1 chamada HTTP real saiu para as 5 consultas (cache evitou o resto)",
    realFetchCalls <= 1,
    { realFetchCalls },
  );

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);

  console.log("\n== Pendente — não executado nesta rodada ==");
  console.log("  Caso 1 (CNPJ MEI ativo → espera 'mei')");
  console.log("  Caso 2 (CNPJ Simples Nacional ativo, não-MEI → espera 'simples_nacional')");
  console.log(
    "  Caso 3 (CNPJ já foi Simples e foi excluído → espera 'nao_detectado', não o status antigo)",
  );
  console.log(
    "  Nenhum CNPJ real verificado dessas 3 categorias foi usado — evitei adivinhar dígitos de\n" +
      "  CNPJ e tratá-los como se fossem uma empresa real dessa categoria sem confirmação.",
  );

  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  globalThis.fetch = originalFetch;
  console.error("\nerro fatal:", error);
  process.exit(1);
});
