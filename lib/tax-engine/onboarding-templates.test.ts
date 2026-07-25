import { describe, expect, it } from "vitest";

import { buildTaxTemplatePlan, parseBrRate } from "@/lib/tax-engine/onboarding-templates";

/**
 * Templates de onboarding fiscal (briefing §6): "Simples Nacional (sem
 * destaque)", "Isento" e "ICMS + IPI padrão". Espelha T-01/T-01b da matriz
 * de casos-teste-fiscais para a parte de configuração (não o cálculo).
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
