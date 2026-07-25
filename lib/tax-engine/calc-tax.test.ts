import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { calcItemTaxes, calcTax, documentTotals } from "@/lib/tax-engine/calc-tax";
import type { TaxRateOverride, TaxType } from "@/lib/tax-engine/types";

/**
 * Casos T-01 a T-20 de
 * .claude/skills/casos-teste-fiscais/references/matriz-casos.md.
 * Todos os valores de 6 casas vêm literalmente da matriz / briefing §5, §7.
 */

function fixed6(value: Decimal) {
  return value.toFixed(6);
}

describe("calcTax — fórmula pura (briefing §5)", () => {
  it("inclusive com rate=5: base + tax reconstrói o preço", () => {
    const { base, tax, gross } = calcTax(100, 5, "inclusive");
    expect(fixed6(base)).toBe("95.238095");
    expect(fixed6(tax)).toBe("4.761905");
    expect(fixed6(gross)).toBe("100.000000");
  });

  it("exclusive com rate=18: imposto soma por cima", () => {
    const { base, tax, gross } = calcTax(100, 18, "exclusive");
    expect(fixed6(base)).toBe("100.000000");
    expect(fixed6(tax)).toBe("18.000000");
    expect(fixed6(gross)).toBe("118.000000");
  });

  // T-19: alíquota 0 nos dois modos, sem branch/NaN/Infinity.
  it("rate=0 em exclusive é neutro, sem branch especial", () => {
    const { base, tax, gross } = calcTax(100, 0, "exclusive");
    expect(fixed6(base)).toBe("100.000000");
    expect(fixed6(tax)).toBe("0.000000");
    expect(fixed6(gross)).toBe("100.000000");
  });

  it("rate=0 em inclusive é neutro, sem divisão por zero", () => {
    const { base, tax, gross } = calcTax(100, 0, "inclusive");
    expect(fixed6(base)).toBe("100.000000");
    expect(fixed6(tax)).toBe("0.000000");
    expect(fixed6(gross)).toBe("100.000000");
  });

  // T-20: propriedade — inclusive sempre reconstrói o preço, tolerância 1e-6.
  it.each([
    [10, 5],
    [33.33, 5],
    [99.99, 5],
    [1234.56, 5],
    [100, 0],
    [100, 12],
    [100, 18],
    [100, 100],
  ])("propriedade inclusive: base + tax === preço (preço=%s, rate=%s)", (price, rate) => {
    const { base, tax } = calcTax(price, rate, "inclusive");
    const diff = base.plus(tax).minus(price).abs();
    expect(diff.lessThanOrEqualTo("0.000001")).toBe(true);
  });

  it("rate=100 em inclusive divide o preço ao meio", () => {
    const { base, tax } = calcTax(100, 100, "inclusive");
    expect(fixed6(base)).toBe("50.000000");
    expect(fixed6(tax)).toBe("50.000000");
  });

  // Achado do revisor-precisao-monetaria: com rate=50, derivar `tax` da BASE
  // já arredondada em 6 casas (em vez da divisão de precisão total) produzia
  // 66.666667 + 33.333334 = 100.000001 — quebra a reconstrução exata que o
  // §5 promete. `tax` precisa vir do quociente de precisão total.
  it("rate=50 em inclusive reconstrói o preço exatamente, sem arredondamento intermediário", () => {
    const { base, tax } = calcTax(100, 50, "inclusive");
    expect(fixed6(base)).toBe("66.666667");
    expect(fixed6(tax)).toBe("33.333333");
    expect(base.plus(tax).toFixed(6)).toBe("100.000000");
  });
});

describe("calcItemTaxes — item completo (por linha, não cumulativo)", () => {
  const p1 = { id: "p1", categoryId: "cat-a" };
  const p2 = { id: "p2", categoryId: "cat-a" };
  const p3 = { id: "p3", categoryId: "cat-a" };
  const p9 = { id: "p9", categoryId: "cat-b" };

  // T-01 / T-01b: organização sem nenhum tax_type ativo.
  it("sem tax_types: 0 linhas de imposto, line_total = preço de catálogo", () => {
    const result = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [],
      overrides: [],
    });
    expect(result.taxes).toHaveLength(0);
    expect(fixed6(result.lineTotal)).toBe("100.000000");
    expect(fixed6(result.unitBaseDisplay)).toBe("100.000000");
  });

  // T-02: IPI embutido, inclusive 5%, override de categoria.
  it("IPI inclusive 5% por categoria — reconstrói o preço e não soma ao total", () => {
    const ipi: TaxType = {
      id: "ipi",
      code: "IPI",
      label: "IPI",
      mode: "inclusive",
      defaultRate: 0,
      active: true,
      displayOrder: 2,
    };
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "ipi", categoryId: "cat-a", productId: null, rate: 5, note: null },
    ];

    const result = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [ipi],
      overrides,
    });

    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0].rateSource).toBe("category");
    expect(fixed6(result.taxes[0].baseAmount)).toBe("95.238095");
    expect(fixed6(result.taxes[0].taxAmount)).toBe("4.761905");
    expect(fixed6(result.unitBaseDisplay)).toBe("95.238095");
    expect(fixed6(result.lineTotal)).toBe("100.000000");
  });

  // T-03: ICMS por fora, exclusive 18%, produto normal.
  it("ICMS exclusive 18% por categoria — soma ao total", () => {
    const icms: TaxType = {
      id: "icms",
      code: "ICMS",
      label: "ICMS",
      mode: "exclusive",
      defaultRate: 0,
      active: true,
      displayOrder: 1,
    };
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "icms", categoryId: "cat-a", productId: null, rate: 18, note: null },
    ];

    const result = calcItemTaxes({
      product: p2,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [icms],
      overrides,
    });

    expect(fixed6(result.taxes[0].baseAmount)).toBe("100.000000");
    expect(fixed6(result.taxes[0].taxAmount)).toBe("18.000000");
    expect(fixed6(result.lineTotal)).toBe("118.000000");
  });

  // T-04 via calcItemTaxes: produto com override 0 + nota, mesma categoria com 18%.
  it("produto isento por ST (rate=0 + nota) não é cobrado, mesma categoria com 18%", () => {
    const icms: TaxType = {
      id: "icms",
      code: "ICMS",
      label: "ICMS",
      mode: "exclusive",
      defaultRate: 0,
      active: true,
      displayOrder: 1,
    };
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

    const result = calcItemTaxes({
      product: p3,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [icms],
      overrides,
    });

    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0].rateSource).toBe("product");
    expect(result.taxes[0].note).toBe("ICMS-ST recolhido pelo fabricante");
    expect(fixed6(result.taxes[0].taxAmount)).toBe("0.000000");
    expect(fixed6(result.lineTotal)).toBe("100.000000");
  });

  // T-10: tributo inativo nem entra no laço.
  it("tributo inativo não gera linha de imposto", () => {
    const icms: TaxType = {
      id: "icms",
      code: "ICMS",
      label: "ICMS",
      mode: "exclusive",
      defaultRate: 25,
      active: false,
      displayOrder: 1,
    };
    const result = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [icms],
      overrides: [],
    });
    expect(result.taxes).toHaveLength(0);
    expect(fixed6(result.lineTotal)).toBe("100.000000");
  });

  // T-11: dois tributos exclusive, comutatividade sob display_order invertido.
  it("dois tributos exclusive são comutativos — display_order não afeta o valor", () => {
    const icms: TaxType = {
      id: "icms",
      code: "ICMS",
      label: "ICMS",
      mode: "exclusive",
      defaultRate: 18,
      active: true,
      displayOrder: 1,
    };
    const taxa: TaxType = {
      id: "taxa",
      code: "TAXA",
      label: "Taxa",
      mode: "exclusive",
      defaultRate: 10,
      active: true,
      displayOrder: 2,
    };

    const orderA = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [icms, taxa],
      overrides: [],
    });
    const orderB = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [taxa, icms],
      overrides: [],
    });

    for (const result of [orderA, orderB]) {
      const byCode = Object.fromEntries(result.taxes.map((t) => [t.taxCode, t]));
      expect(fixed6(byCode.ICMS.baseAmount)).toBe("100.000000");
      expect(fixed6(byCode.ICMS.taxAmount)).toBe("18.000000");
      expect(fixed6(byCode.TAXA.baseAmount)).toBe("100.000000");
      expect(fixed6(byCode.TAXA.taxAmount)).toBe("10.000000");
      expect(fixed6(result.lineTotal)).toBe("128.000000");
    }
  });

  // T-12: inclusive + exclusive no mesmo item — não cumulativo, ambos olham para o mesmo preço.
  it("inclusive e exclusive no mesmo item calculam sobre o mesmo preço de partida", () => {
    const icms: TaxType = {
      id: "icms",
      code: "ICMS",
      label: "ICMS",
      mode: "exclusive",
      defaultRate: 18,
      active: true,
      displayOrder: 1,
    };
    const ipi: TaxType = {
      id: "ipi",
      code: "IPI",
      label: "IPI",
      mode: "inclusive",
      defaultRate: 5,
      active: true,
      displayOrder: 2,
    };

    const result = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [icms, ipi],
      overrides: [],
    });
    const byCode = Object.fromEntries(result.taxes.map((t) => [t.taxCode, t]));

    expect(fixed6(byCode.ICMS.baseAmount)).toBe("100.000000");
    expect(fixed6(byCode.ICMS.taxAmount)).toBe("18.000000");
    expect(fixed6(byCode.IPI.baseAmount)).toBe("95.238095");
    expect(fixed6(byCode.IPI.taxAmount)).toBe("4.761905");
    // Só o exclusive soma ao total — inclusive já estava embutido no preço.
    expect(fixed6(result.lineTotal)).toBe("118.000000");
  });

  // Achado do revisor-invariantes: unitBaseDisplay não pode depender da ordem
  // de chegada do array quando há mais de um tributo inclusive — precisa ser
  // determinístico por display_order (a semântica de QUAL base é a "correta"
  // continua em aberto, ver comentário em calc-tax.ts).
  it("dois tributos inclusive: unitBaseDisplay é determinístico por display_order, não pela ordem do array", () => {
    const ipi: TaxType = {
      id: "ipi",
      code: "IPI",
      label: "IPI",
      mode: "inclusive",
      defaultRate: 5,
      active: true,
      displayOrder: 1,
    };
    const outroInclusive: TaxType = {
      id: "outro",
      code: "OUTRO",
      label: "Outro",
      mode: "inclusive",
      defaultRate: 10,
      active: true,
      displayOrder: 2,
    };

    const arrayOrderNormal = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [ipi, outroInclusive],
      overrides: [],
    });
    const arrayOrderInvertido = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 1,
      taxTypes: [outroInclusive, ipi],
      overrides: [],
    });

    // displayOrder=2 (OUTRO) processa por último nos dois casos — mesmo valor.
    expect(fixed6(arrayOrderNormal.unitBaseDisplay)).toBe(
      fixed6(arrayOrderInvertido.unitBaseDisplay),
    );
  });

  // T-16: 7 unidades a R$100 com IPI inclusive 5% — calcula por linha, não por unidade.
  it("quantidade > 1: calcula sobre preço×quantidade antes do imposto (por linha)", () => {
    const ipi: TaxType = {
      id: "ipi",
      code: "IPI",
      label: "IPI",
      mode: "inclusive",
      defaultRate: 5,
      active: true,
      displayOrder: 1,
    };

    const result = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 7,
      taxTypes: [ipi],
      overrides: [],
    });

    // Asserta a BASE, não só o total — é o que denuncia cálculo por unidade arredondada.
    expect(fixed6(result.taxes[0].baseAmount)).toBe("666.666667");
    expect(fixed6(result.taxes[0].taxAmount)).toBe("33.333333");
    expect(fixed6(result.lineTotal)).toBe("700.000000");
  });

  // T-17: múltiplos itens, tributos diferentes por categoria.
  it("documento com múltiplos itens soma line_total corretamente por item", () => {
    const ipi: TaxType = {
      id: "ipi",
      code: "IPI",
      label: "IPI",
      mode: "inclusive",
      defaultRate: 0,
      active: true,
      displayOrder: 1,
    };
    const icms: TaxType = {
      id: "icms",
      code: "ICMS",
      label: "ICMS",
      mode: "exclusive",
      defaultRate: 0,
      active: true,
      displayOrder: 2,
    };
    const overrides: TaxRateOverride[] = [
      { taxTypeId: "ipi", categoryId: "cat-a", productId: null, rate: 5, note: null },
      { taxTypeId: "icms", categoryId: "cat-b", productId: null, rate: 18, note: null },
    ];

    const item1 = calcItemTaxes({
      product: p1,
      unitPrice: 100,
      quantity: 7,
      taxTypes: [ipi, icms],
      overrides,
    });
    const item2 = calcItemTaxes({
      product: p9,
      unitPrice: 49.9,
      quantity: 3,
      taxTypes: [ipi, icms],
      overrides,
    });

    expect(fixed6(item1.lineTotal)).toBe("700.000000");
    expect(fixed6(item2.taxes.find((t) => t.taxCode === "ICMS")!.taxAmount)).toBe("26.946000");
    expect(fixed6(item2.lineTotal)).toBe("176.646000");

    const totals = documentTotals([item1, item2]);
    expect(totals.total.toFixed(2)).toBe("876.65");
    expect(totals.taxesByCode.get("IPI")!.toFixed(2)).toBe("33.33");
    expect(totals.taxesByCode.get("ICMS")!.toFixed(2)).toBe("26.95");
  });

  // T-18: arredonda só no fim — soma em 6 casas, arredonda depois.
  it("soma o rodapé em 6 casas antes de arredondar, não arredonda linha a linha", () => {
    const taxa: TaxType = {
      id: "taxa",
      code: "TAXA",
      label: "Taxa",
      mode: "exclusive",
      defaultRate: 5,
      active: true,
      displayOrder: 1,
    };
    const product = { id: "p-x", categoryId: null };

    const items = [
      calcItemTaxes({ product, unitPrice: 2.5, quantity: 1, taxTypes: [taxa], overrides: [] }),
      calcItemTaxes({ product, unitPrice: 2.5, quantity: 1, taxTypes: [taxa], overrides: [] }),
      calcItemTaxes({ product, unitPrice: 2.5, quantity: 1, taxTypes: [taxa], overrides: [] }),
    ];

    const totals = documentTotals(items);
    // Correto: 0.125000 × 3 = 0.375000 → R$0,38. Errado seria 0,13 × 3 = R$0,39.
    expect(totals.taxesByCode.get("TAXA")!.toFixed(2)).toBe("0.38");
    // Correto: 2.625000 × 3 = 7.875000 → R$7,88. Errado seria 2,63 × 3 = R$7,89.
    expect(totals.total.toFixed(2)).toBe("7.88");
  });
});
