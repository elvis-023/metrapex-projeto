import { describe, expect, it } from "vitest";

import { resolveRate } from "@/lib/tax-engine/resolve-rate";
import type { TaxRateOverride, TaxType } from "@/lib/tax-engine/types";

/**
 * Casos T-04 a T-10 de
 * .claude/skills/casos-teste-fiscais/references/matriz-casos.md — Bloco 3
 * (hierarquia e o override de alíquota zero).
 */

const icms: TaxType = {
  id: "icms",
  code: "ICMS",
  label: "ICMS",
  mode: "exclusive",
  defaultRate: 18,
  active: true,
  displayOrder: 1,
};

describe("resolveRate", () => {
  // T-04: override de PRODUTO com rate = 0 vence a categoria e PARA a busca.
  it("override de produto com rate = 0 vence a categoria (ST) — não cai para 18%", () => {
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "icms", categoryId: "cat-a", productId: null, rate: 18, note: null },
      {
        taxTypeId: "icms",
        categoryId: null,
        productId: "p3",
        rate: 0,
        note: "ICMS-ST recolhido pelo fabricante",
      },
    ];

    const result = resolveRate(icms, { id: "p3", categoryId: "cat-a" }, overrides);

    expect(result).toEqual({
      rate: 0,
      source: "product",
      note: "ICMS-ST recolhido pelo fabricante",
    });
  });

  // T-05: só org_default, produto sem override e sem categoria.
  it("cai para org_default quando não há nenhum override", () => {
    const result = resolveRate(icms, { id: "p4", categoryId: null }, []);
    expect(result).toEqual({ rate: 18, source: "org_default", note: null });
  });

  // T-06: categoria vence org_default.
  it("override de categoria vence o padrão da organização", () => {
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "icms", categoryId: "cat-a", productId: null, rate: 12, note: null },
    ];
    const result = resolveRate(icms, { id: "p5", categoryId: "cat-a" }, overrides);
    expect(result).toEqual({ rate: 12, source: "category", note: null });
  });

  // T-07: produto vence categoria (rate != 0, para descartar falso positivo do T-04).
  it("override de produto vence categoria mesmo com rate diferente de zero", () => {
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "icms", categoryId: "cat-a", productId: null, rate: 12, note: null },
      { taxTypeId: "icms", categoryId: null, productId: "p6", rate: 7, note: null },
    ];
    const result = resolveRate(icms, { id: "p6", categoryId: "cat-a" }, overrides);
    expect(result).toEqual({ rate: 7, source: "product", note: null });
  });

  // T-08: produto sem categoria pula direto para org_default, ignorando override de outra categoria.
  it("produto sem categoria pula o passo de categoria", () => {
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "icms", categoryId: "cat-a", productId: null, rate: 12, note: null },
    ];
    const result = resolveRate(icms, { id: "p7", categoryId: null }, overrides);
    expect(result).toEqual({ rate: 18, source: "org_default", note: null });
  });

  // T-09: override de CATEGORIA com rate = 0 também é válido e vence org_default.
  it("override de categoria com rate = 0 vence org_default", () => {
    const overrides: TaxRateOverride[] = [
      {
        taxTypeId: "icms",
        categoryId: "cat-b",
        productId: null,
        rate: 0,
        note: "Isento nesta categoria",
      },
    ];
    const result = resolveRate(icms, { id: "p8", categoryId: "cat-b" }, overrides);
    expect(result).toEqual({ rate: 0, source: "category", note: "Isento nesta categoria" });
  });

  // Variantes explícitas do modo de falha descrito na skill calculo-tributario §4:
  // truthiness/`||`/`??` sobre `rate` derrubam a isenção para a categoria.
  it("nunca usa truthiness do rate — override de produto com rate=0 não é 'vazio'", () => {
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "icms", categoryId: "cat-a", productId: null, rate: 18, note: null },
      { taxTypeId: "icms", categoryId: null, productId: "p3", rate: 0, note: "isento" },
    ];
    const result = resolveRate(icms, { id: "p3", categoryId: "cat-a" }, overrides);
    expect(result.source).toBe("product");
    expect(result.rate).toBe(0);
  });
});
