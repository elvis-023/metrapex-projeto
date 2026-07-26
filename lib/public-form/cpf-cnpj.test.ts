import { describe, expect, it } from "vitest";

import { isValidCnpj, isValidCpf, isValidDocument } from "@/lib/public-form/cpf-cnpj";

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
