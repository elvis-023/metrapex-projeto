import { describe, expect, it } from "vitest";

import { taxRegimeOptions } from "@/lib/onboarding/mock-data";

/**
 * Passo 2 do onboarding — Lucro Presumido e Lucro Real viraram um único card
 * na tela ("Lucro Presumido ou Lucro Real"), mas o banco continua com os 2
 * valores (organizations.tax_regime). O card sempre grava `lucro_presumido`
 * (`id`), e `matches` é quem decide se o card aparece selecionado — inclui
 * `lucro_real` pra cobrir organização que já tenha esse valor gravado.
 */
describe("taxRegimeOptions — unificação Lucro Presumido / Lucro Real", () => {
  it("tem só 3 cards (não existe mais 'lucro_real' como card próprio)", () => {
    expect(taxRegimeOptions).toHaveLength(3);
    expect(taxRegimeOptions.map((option) => option.id)).toEqual([
      "mei",
      "simples_nacional",
      "lucro_presumido",
    ]);
  });

  it("o card 'lucro_presumido' casa com os dois valores do banco", () => {
    const option = taxRegimeOptions.find((o) => o.id === "lucro_presumido");
    expect(option?.matches).toEqual(["lucro_presumido", "lucro_real"]);
    expect(option?.label).toBe("Lucro Presumido ou Lucro Real");
  });

  it("mei e simples_nacional só casam com o próprio valor", () => {
    const mei = taxRegimeOptions.find((o) => o.id === "mei");
    const simples = taxRegimeOptions.find((o) => o.id === "simples_nacional");
    expect(mei?.matches).toEqual(["mei"]);
    expect(simples?.matches).toEqual(["simples_nacional"]);
  });
});
