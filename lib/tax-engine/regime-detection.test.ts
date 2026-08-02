import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyCnpjRegime } from "@/lib/tax-engine/regime-detection";

/**
 * Bloco 7 — detecção automática de regime por CNPJ. `opcao_pelo_mei`/
 * `opcao_pelo_simples` vêm nuláveis da BrasilAPI (confirmado por chamada
 * real, Petrobras, `null` = nunca optou — decisão "Regime Tributário #5").
 */
describe("classifyCnpjRegime", () => {
  it("opção pelo MEI = true → mei", () => {
    expect(classifyCnpjRegime({ opcaoPeloMei: true, opcaoPeloSimples: null })).toBe("mei");
  });

  it("opção pelo Simples = true (MEI false) → simples_nacional", () => {
    expect(classifyCnpjRegime({ opcaoPeloMei: false, opcaoPeloSimples: true })).toBe(
      "simples_nacional",
    );
  });

  it("opção pelo Simples = true (MEI null) → simples_nacional", () => {
    expect(classifyCnpjRegime({ opcaoPeloMei: null, opcaoPeloSimples: true })).toBe(
      "simples_nacional",
    );
  });

  it("MEI true prevalece sobre Simples true (MEI é mais específico — SIMEI)", () => {
    expect(classifyCnpjRegime({ opcaoPeloMei: true, opcaoPeloSimples: true })).toBe("mei");
  });

  it("ambos null (nunca optou, caso real confirmado — Petrobras) → nao_detectado", () => {
    expect(classifyCnpjRegime({ opcaoPeloMei: null, opcaoPeloSimples: null })).toBe(
      "nao_detectado",
    );
  });

  it("ambos false → nao_detectado", () => {
    expect(classifyCnpjRegime({ opcaoPeloMei: false, opcaoPeloSimples: false })).toBe(
      "nao_detectado",
    );
  });
});

/**
 * `fetchCnpjData` mockado — primeiro precedente de `vi.mock` no projeto,
 * justificado porque, diferente dos wrappers simples de
 * `lib/integrations/*.ts` (só repassam a chamada), o cache com TTL aqui é
 * lógica de verdade com jeito de esconder bug (chave errada, TTL não expira,
 * falha não cacheada) que só um teste com controle do tempo pega.
 */
vi.mock("@/lib/integrations/brasil-api", () => ({
  fetchCnpjData: vi.fn(),
}));

describe("detectRegimeFromCnpj", () => {
  beforeEach(() => {
    // `vi.mock` (hoisted) devolve o MESMO `vi.fn()` entre testes mesmo com
    // `resetModules` — só `resetModules` isola o estado do SUT (o `Map` de
    // cache de `regime-detection.ts`, reimportado do zero a cada teste); o
    // histórico de chamadas do mock precisa ser limpo à parte.
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("consulta a BrasilAPI e classifica o resultado", async () => {
    const { fetchCnpjData } = await import("@/lib/integrations/brasil-api");
    const { detectRegimeFromCnpj } = await import("@/lib/tax-engine/regime-detection");
    vi.mocked(fetchCnpjData).mockResolvedValue({
      legalName: "Empresa Teste",
      address: {
        zip: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
      porte: "MICRO EMPRESA",
      codigoPorte: 1,
      opcaoPeloMei: true,
      opcaoPeloSimples: null,
    });

    expect(await detectRegimeFromCnpj("11222333000181")).toBe("mei");
    expect(fetchCnpjData).toHaveBeenCalledTimes(1);
  });

  it("segunda chamada com o MESMO CNPJ dentro do TTL não bate na API de novo (cache)", async () => {
    const { fetchCnpjData } = await import("@/lib/integrations/brasil-api");
    const { detectRegimeFromCnpj } = await import("@/lib/tax-engine/regime-detection");
    vi.mocked(fetchCnpjData).mockResolvedValue({
      legalName: "Empresa Teste",
      address: {
        zip: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
      porte: null,
      codigoPorte: null,
      opcaoPeloMei: null,
      opcaoPeloSimples: true,
    });

    expect(await detectRegimeFromCnpj("22333444000195")).toBe("simples_nacional");
    expect(await detectRegimeFromCnpj("22333444000195")).toBe("simples_nacional");
    expect(fetchCnpjData).toHaveBeenCalledTimes(1);
  });

  it("depois do TTL expirar, consulta a API de novo para o mesmo CNPJ", async () => {
    const { fetchCnpjData } = await import("@/lib/integrations/brasil-api");
    const { detectRegimeFromCnpj } = await import("@/lib/tax-engine/regime-detection");
    vi.mocked(fetchCnpjData).mockResolvedValue({
      legalName: "Empresa Teste",
      address: {
        zip: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
      porte: null,
      codigoPorte: null,
      opcaoPeloMei: true,
      opcaoPeloSimples: null,
    });

    expect(await detectRegimeFromCnpj("33444555000109")).toBe("mei");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(await detectRegimeFromCnpj("33444555000109")).toBe("mei");
    expect(fetchCnpjData).toHaveBeenCalledTimes(2);
  });

  it("falha na consulta (rede/timeout) vira nao_detectado, nunca lança", async () => {
    const { fetchCnpjData } = await import("@/lib/integrations/brasil-api");
    const { detectRegimeFromCnpj } = await import("@/lib/tax-engine/regime-detection");
    vi.mocked(fetchCnpjData).mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(detectRegimeFromCnpj("44555666000112")).resolves.toBe("nao_detectado");
  });
});
