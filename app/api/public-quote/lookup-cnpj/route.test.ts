import { describe, expect, it } from "vitest";

import { formatStreet } from "@/app/api/public-quote/lookup-cnpj/route";

/**
 * A BrasilAPI separa o tipo do logradouro ("AVENIDA") do nome ("REPUBLICA DO
 * CHILE") em dois campos — usar só `logradouro` deixava o endereço sem
 * "Rua"/"Avenida"/etc. Bug relatado pelo usuário, reproduzido com o CNPJ
 * real da Petrobras (33.000.167/0001-01): a API devolve
 * `descricao_tipo_de_logradouro: "AVENIDA"` e `logradouro: "REPUBLICA DO CHILE"`.
 */
describe("formatStreet", () => {
  it("junta tipo e nome do logradouro", () => {
    expect(formatStreet("AVENIDA", "REPUBLICA DO CHILE")).toBe("AVENIDA REPUBLICA DO CHILE");
  });

  it("sem tipo de logradouro, usa só o nome (não quebra endereço sem esse dado)", () => {
    expect(formatStreet(undefined, "REPUBLICA DO CHILE")).toBe("REPUBLICA DO CHILE");
  });

  it("sem nenhum dos dois, string vazia", () => {
    expect(formatStreet(undefined, undefined)).toBe("");
  });

  it("não deixa espaço sobrando quando só um lado existe", () => {
    expect(formatStreet("", "REPUBLICA DO CHILE")).toBe("REPUBLICA DO CHILE");
    expect(formatStreet("AVENIDA", "")).toBe("AVENIDA");
  });
});
