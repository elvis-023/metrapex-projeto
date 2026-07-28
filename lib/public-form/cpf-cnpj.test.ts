import { describe, expect, it } from "vitest";

import {
  detectDocumentType,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  normalizeDocument,
} from "@/lib/public-form/cpf-cnpj";

describe("isValidCpf", () => {
  it("aceita CPF com dígito verificador correto", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("recusa dígito verificador incorreto", () => {
    expect(isValidCpf("11144477736")).toBe(false);
  });

  it("recusa sequência repetida (passa no tamanho, nunca é CPF real)", () => {
    expect(isValidCpf("11111111111")).toBe(false);
  });

  it("recusa tamanho errado", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJ com dígito verificador correto", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador incorreto", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
  });

  it("recusa sequência repetida (o achado da revisão adversarial)", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("recusa tamanho errado", () => {
    expect(isValidCnpj("123")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
});

describe("isValidDocument", () => {
  it("despacha para o validador certo conforme o tipo", () => {
    expect(isValidDocument("cpf", "11144477735")).toBe(true);
    expect(isValidDocument("cnpj", "11144477735")).toBe(false);
    expect(isValidDocument("cnpj", "11222333000181")).toBe(true);
  });
});

/**
 * O formulário público não tem seletor de CPF/CNPJ — o tipo é deduzido do
 * que foi digitado. Estes casos cobrem a digitação em andamento, que é onde
 * a dedução pode escorregar.
 */
describe("detectDocumentType", () => {
  it("11 dígitos é CPF, 14 é CNPJ", () => {
    expect(detectDocumentType("11144477735")).toBe("cpf");
    expect(detectDocumentType("11222333000181")).toBe("cnpj");
  });

  it("ignora a máscara", () => {
    expect(detectDocumentType("111.444.777-35")).toBe("cpf");
    expect(detectDocumentType("11.222.333/0001-81")).toBe("cnpj");
  });

  it("indeterminado enquanto o cliente ainda está digitando", () => {
    expect(detectDocumentType("")).toBeNull();
    expect(detectDocumentType("1112223")).toBeNull();
    // 12 e 13 dígitos: passou do CPF, ainda não chegou no CNPJ.
    expect(detectDocumentType("112223330001")).toBeNull();
    expect(detectDocumentType("1122233300018")).toBeNull();
  });

  it("deduz o tipo pelo tamanho, mesmo com dígito verificador inválido", () => {
    // Quem decide validade é isValidCpf/isValidCnpj — detectDocumentType só
    // escolhe QUAL validador aplicar, senão um documento errado ficaria sem
    // tipo e o formulário não teria como apontar o erro.
    expect(detectDocumentType("11111111111")).toBe("cpf");
    expect(detectDocumentType("11111111111111")).toBe("cnpj");
  });
});

/**
 * `lib/customers/actions.ts` (Milestone 17) roda isto ANTES de chamar
 * `upsert_customer` — com ou sem máscara precisa colapsar nos MESMOS dígitos,
 * senão o dedupe por (org_id, document) veria dois documentos diferentes.
 */
describe("normalizeDocument", () => {
  it("CNPJ com e sem máscara normalizam para os mesmos dígitos", () => {
    const masked = normalizeDocument("11.222.333/0001-81");
    const unmasked = normalizeDocument("11222333000181");
    expect(masked).toEqual({ ok: true, digits: "11222333000181", type: "cnpj" });
    expect(unmasked).toEqual(masked);
  });

  it("CPF com e sem máscara normalizam para os mesmos dígitos", () => {
    const masked = normalizeDocument("111.444.777-35");
    const unmasked = normalizeDocument("11144477735");
    expect(masked).toEqual({ ok: true, digits: "11144477735", type: "cpf" });
    expect(unmasked).toEqual(masked);
  });

  it("recusa dígito verificador inválido mesmo com máscara bem formada", () => {
    const result = normalizeDocument("11.222.333/0001-82");
    expect(result).toEqual({ ok: false, error: "CNPJ inválido." });
  });

  it("recusa tamanho que não é nem CPF nem CNPJ", () => {
    expect(normalizeDocument("123")).toEqual({
      ok: false,
      error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.",
    });
  });
});
