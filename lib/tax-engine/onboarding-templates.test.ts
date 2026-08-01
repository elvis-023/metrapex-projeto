import { describe, expect, it } from "vitest";

import {
  buildTaxTemplatePlan,
  isValidTaxRegime,
  parseBrRate,
  TAX_REGIMES,
  templateIdForRegime,
} from "@/lib/tax-engine/onboarding-templates";

/**
 * Templates de onboarding fiscal (briefing §6): "Simples Nacional (sem
 * destaque)", "Isento", "ICMS + IPI padrão" e "lucro-real". Espelha
 * T-01/T-01b da matriz de casos-teste-fiscais para a parte de configuração
 * (não o cálculo — resolveRate/calcTax não mudam com o Regime Tributário).
 */
describe("buildTaxTemplatePlan", () => {
  it("Simples Nacional: nenhum tax_type, rodapé informativo, sem linhas de imposto", () => {
    const plan = buildTaxTemplatePlan({
      templateId: "simples",
      icmsRate: 18,
      footerText: "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
    });

    expect(plan.taxTypes).toHaveLength(0);
    expect(plan.settings).toEqual({
      documentFooter: "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
      showTaxLines: false,
    });
  });

  it("Isento: nenhum tax_type, nenhum rodapé", () => {
    const plan = buildTaxTemplatePlan({ templateId: "isento", icmsRate: 18, footerText: "" });

    expect(plan.taxTypes).toHaveLength(0);
    expect(plan.settings).toEqual({ documentFooter: null, showTaxLines: false });
  });

  it("ICMS + IPI padrão: ICMS exclusive no padrão informado, IPI inclusive com default_rate 0", () => {
    const plan = buildTaxTemplatePlan({ templateId: "icms-ipi", icmsRate: 18, footerText: "" });

    expect(plan.taxTypes).toEqual([
      { code: "ICMS", label: "ICMS", mode: "exclusive", defaultRate: 18, displayOrder: 1 },
      { code: "IPI", label: "IPI", mode: "inclusive", defaultRate: 0, displayOrder: 2 },
    ]);
    expect(plan.settings).toEqual({ documentFooter: null, showTaxLines: true });
  });

  it("ICMS + IPI padrão: usa a alíquota de ICMS informada pelo usuário no wizard", () => {
    const plan = buildTaxTemplatePlan({ templateId: "icms-ipi", icmsRate: 12, footerText: "" });
    expect(plan.taxTypes[0].defaultRate).toBe(12);
  });

  // Lucro Real: entrada própria em buildTaxTemplatePlan (decisão registrada em
  // .claude/skills/decisao-pendente/references/decisoes-registradas.md, "Regime
  // Tributário" #2) — não um alias de "icms-ipi", mesmo que o conteúdo inicial
  // seja igual hoje. O teste de equivalência abaixo prova a coincidência atual
  // SEM provar que são o mesmo case: a rejeição de fallthrough é responsabilidade
  // da leitura de código / do teste de `templateIdForRegime`.
  it("Lucro Real: ICMS exclusive no padrão informado, IPI inclusive com default_rate 0", () => {
    const plan = buildTaxTemplatePlan({ templateId: "lucro-real", icmsRate: 18, footerText: "" });

    expect(plan.taxTypes).toEqual([
      { code: "ICMS", label: "ICMS", mode: "exclusive", defaultRate: 18, displayOrder: 1 },
      { code: "IPI", label: "IPI", mode: "inclusive", defaultRate: 0, displayOrder: 2 },
    ]);
    expect(plan.settings).toEqual({ documentFooter: null, showTaxLines: true });
  });

  it("Lucro Real: usa a alíquota de ICMS informada pelo usuário no wizard", () => {
    const plan = buildTaxTemplatePlan({ templateId: "lucro-real", icmsRate: 12, footerText: "" });
    expect(plan.taxTypes[0].defaultRate).toBe(12);
  });

  it("Lucro Real e Lucro Presumido coincidem hoje no conteúdo inicial (mesma alíquota de entrada)", () => {
    const presumido = buildTaxTemplatePlan({ templateId: "icms-ipi", icmsRate: 18, footerText: "" });
    const real = buildTaxTemplatePlan({ templateId: "lucro-real", icmsRate: 18, footerText: "" });
    expect(real).toEqual(presumido);
  });
});

describe("templateIdForRegime", () => {
  it("MEI usa o preset sem destaque", () => {
    expect(templateIdForRegime("mei")).toBe("simples");
  });

  it("Simples Nacional usa o preset sem destaque", () => {
    expect(templateIdForRegime("simples_nacional")).toBe("simples");
  });

  it("Lucro Presumido usa o preset ICMS + IPI padrão", () => {
    expect(templateIdForRegime("lucro_presumido")).toBe("icms-ipi");
  });

  it("Lucro Real usa a entrada própria, não o preset do Lucro Presumido", () => {
    expect(templateIdForRegime("lucro_real")).toBe("lucro-real");
    expect(templateIdForRegime("lucro_real")).not.toBe(templateIdForRegime("lucro_presumido"));
  });
});

describe("isValidTaxRegime", () => {
  it("aceita os quatro regimes", () => {
    for (const regime of TAX_REGIMES) {
      expect(isValidTaxRegime(regime)).toBe(true);
    }
  });

  it("rejeita valor fora do enum", () => {
    expect(isValidTaxRegime("lucro_arbitrado")).toBe(false);
    expect(isValidTaxRegime("")).toBe(false);
  });

  it("rejeita nome de template antigo (regime e template não são a mesma coisa)", () => {
    expect(isValidTaxRegime("isento")).toBe(false);
    expect(isValidTaxRegime("icms-ipi")).toBe(false);
  });

  it("é sensível a maiúsculas — não normaliza silenciosamente", () => {
    expect(isValidTaxRegime("MEI")).toBe(false);
  });
});

describe("parseBrRate", () => {
  it("converte formato BR com vírgula decimal", () => {
    expect(parseBrRate("18,00")).toBe(18);
    expect(parseBrRate("5,5")).toBe(5.5);
  });

  it("converte separador de milhar com ponto", () => {
    expect(parseBrRate("1.234,56")).toBe(1234.56);
  });

  it("vazio ou inválido vira 0", () => {
    expect(parseBrRate("")).toBe(0);
    expect(parseBrRate("abc")).toBe(0);
  });
});
