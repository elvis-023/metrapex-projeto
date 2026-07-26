import { describe, expect, it } from "vitest";

import { parseBrPrice, parseStockValue } from "@/lib/catalog/money";

describe("parseBrPrice", () => {
  it("aceita vírgula como separador decimal", () => {
    expect(parseBrPrice("34,90")?.toString()).toBe("34.9");
  });

  it("aceita ponto como separador decimal", () => {
    expect(parseBrPrice("34.90")?.toString()).toBe("34.9");
  });

  it("aceita inteiro sem separador", () => {
    expect(parseBrPrice("58")?.toString()).toBe("58");
  });

  it("aceita prefixo R$", () => {
    expect(parseBrPrice("R$ 34,90")?.toString()).toBe("34.9");
  });

  it("aceita milhar com ponto e centavos com vírgula", () => {
    expect(parseBrPrice("1.250,00")?.toString()).toBe("1250");
  });

  it('"3.990,00" normaliza para 3990.000000 na precisão de gravação (numeric(18,6))', () => {
    expect(parseBrPrice("3.990,00")?.toFixed(6)).toBe("3990.000000");
  });

  it("rejeita texto não numérico", () => {
    expect(parseBrPrice("trinta reais")).toBeNull();
  });

  it("rejeita string vazia", () => {
    expect(parseBrPrice("")).toBeNull();
    expect(parseBrPrice("   ")).toBeNull();
  });

  it("nunca perde precisão de centavos (decimal.js, não float)", () => {
    // 0.1 + 0.2 em float puro dá 0.30000000000000004 — decimal.js não erra isso.
    expect(parseBrPrice("0,10")?.plus(parseBrPrice("0,20")!).toString()).toBe("0.3");
  });
});

describe("parseStockValue", () => {
  it("aceita inteiro maior ou igual a zero", () => {
    expect(parseStockValue("0")).toBe(0);
    expect(parseStockValue("320")).toBe(320);
  });

  it("rejeita negativo", () => {
    expect(parseStockValue("-5")).toBeNull();
  });

  it("rejeita decimal", () => {
    expect(parseStockValue("5,5")).toBeNull();
  });

  it("rejeita texto", () => {
    expect(parseStockValue("abc")).toBeNull();
  });

  it("rejeita vazio", () => {
    expect(parseStockValue("")).toBeNull();
  });
});
