import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  availablePaymentConditions,
  calculateQuote,
  formatQuoteNumber,
  QuoteCalculationError,
  resolveValueBand,
  type CatalogProduct,
  type PaymentCondition,
  type PaymentValueBand,
} from "@/lib/quotes/engine";
import type { TaxRateOverride, TaxType } from "@/lib/tax-engine/types";

/**
 * Motor de orçamento (Milestone 14). Os casos fiscais reusam os números da
 * matriz de .claude/skills/casos-teste-fiscais (briefing §5 e §7) — aqui
 * verificados através do documento inteiro, não da fórmula isolada (que já
 * tem bateria própria em lib/tax-engine/calc-tax.test.ts).
 */

function fixed6(value: Decimal) {
  return value.toFixed(6);
}

const CATEGORY_ID = "cat_ferramentas";

const product: CatalogProduct = {
  id: "prd_1",
  externalCode: "PRD-001",
  name: "Furadeira",
  price: 100,
  categoryId: CATEGORY_ID,
  photoUrl: null,
};

const productWithoutCategory: CatalogProduct = {
  id: "prd_2",
  externalCode: "PRD-002",
  name: "Parafuso",
  price: 50,
  categoryId: null,
  photoUrl: null,
};

const icmsExclusive: TaxType = {
  id: "tax_icms",
  code: "ICMS",
  label: "ICMS",
  mode: "exclusive",
  defaultRate: 18,
  active: true,
  displayOrder: 1,
};

const ipiInclusive: TaxType = {
  id: "tax_ipi",
  code: "IPI",
  label: "IPI",
  mode: "inclusive",
  defaultRate: 0,
  active: true,
  displayOrder: 2,
};

const conditionAVista: PaymentCondition = {
  id: "cond_a_vista",
  label: "À vista (PIX ou dinheiro)",
  kind: "a_vista",
  discountPercent: 5,
  installments: 1,
  termDays: 0,
  active: true,
};

const conditionBoleto: PaymentCondition = {
  id: "cond_boleto",
  label: "Boleto",
  kind: "boleto",
  discountPercent: 0,
  installments: 1,
  termDays: 15,
  active: true,
};

const bands: PaymentValueBand[] = [
  {
    id: "band_ate",
    label: "Até R$ 5.000,00",
    minValue: 0,
    maxValue: 5000,
    paymentConditionIds: [conditionAVista.id, conditionBoleto.id],
  },
  {
    id: "band_acima",
    label: "Acima de R$ 5.000,00",
    minValue: 5000,
    maxValue: null,
    paymentConditionIds: [conditionBoleto.id],
  },
];

function calculate(params: {
  items?: { productId: string; quantity: number }[];
  products?: CatalogProduct[];
  taxTypes?: TaxType[];
  overrides?: TaxRateOverride[];
  discount?: { type: "fixed" | "percent"; value: number };
  paymentConditionId?: string | null;
  paymentConditions?: PaymentCondition[];
  paymentValueBands?: PaymentValueBand[];
}) {
  return calculateQuote({
    items: params.items ?? [{ productId: product.id, quantity: 1 }],
    products: params.products ?? [product, productWithoutCategory],
    categoryNamesById: new Map([[CATEGORY_ID, "Ferramentas"]]),
    taxTypes: params.taxTypes ?? [],
    overrides: params.overrides ?? [],
    discount: params.discount ?? { type: "fixed", value: 0 },
    paymentConditionId: params.paymentConditionId ?? null,
    paymentConditions: params.paymentConditions ?? [],
    paymentValueBands: params.paymentValueBands ?? [],
  });
}

describe("calculateQuote — casos fiscais no documento", () => {
  // T-01: organização sem nenhum tributo é configuração NORMAL.
  it("organização sem tributo emite documento válido, sem linha de imposto", () => {
    const result = calculate({ taxTypes: [] });

    expect(result.items[0].taxes).toHaveLength(0);
    expect(fixed6(result.items[0].unitPriceCharged)).toBe("100.000000");
    expect(fixed6(result.items[0].unitBaseDisplay)).toBe("100.000000");
    expect(fixed6(result.items[0].lineTotal)).toBe("100.000000");
    expect(fixed6(result.total)).toBe("100.000000");
    expect(result.taxTotals).toHaveLength(0);
  });

  // T-02: IPI embutido 5% por categoria.
  it("inclusive 5% por categoria: base + imposto reconstrói o preço de catálogo", () => {
    const result = calculate({
      taxTypes: [ipiInclusive],
      overrides: [
        {
          taxTypeId: ipiInclusive.id,
          categoryId: CATEGORY_ID,
          productId: null,
          rate: 5,
          note: null,
        },
      ],
    });

    const [item] = result.items;
    const [tax] = item.taxes;

    expect(tax.rateSource).toBe("category");
    expect(fixed6(tax.baseAmount)).toBe("95.238095");
    expect(fixed6(tax.taxAmount)).toBe("4.761905");
    expect(fixed6(tax.baseAmount.plus(tax.taxAmount))).toBe("100.000000");
    expect(fixed6(item.unitBaseDisplay)).toBe("95.238095");
    // Embutido NÃO soma ao total a pagar.
    expect(fixed6(item.lineTotal)).toBe("100.000000");
    expect(fixed6(result.total)).toBe("100.000000");
    expect(fixed6(result.inclusiveTaxTotal)).toBe("4.761905");
    expect(fixed6(result.exclusiveTaxTotal)).toBe("0.000000");
  });

  // T-03: ICMS por fora soma ao total.
  it("exclusive 18% no padrão da organização soma por cima", () => {
    const result = calculate({ taxTypes: [icmsExclusive] });

    expect(result.items[0].taxes[0].rateSource).toBe("org_default");
    expect(fixed6(result.items[0].lineTotal)).toBe("118.000000");
    expect(fixed6(result.exclusiveTaxTotal)).toBe("18.000000");
    expect(fixed6(result.total)).toBe("118.000000");
  });

  // T-04: o caso mais caro do sistema — override de produto com rate 0 vence a
  // categoria e PARA a busca. Falhar aqui é cobrança indevida, não erro de tela.
  it("override de produto com rate 0 (ST) vence a categoria e preserva a nota", () => {
    const result = calculate({
      taxTypes: [icmsExclusive],
      overrides: [
        {
          taxTypeId: icmsExclusive.id,
          categoryId: CATEGORY_ID,
          productId: null,
          rate: 18,
          note: null,
        },
        {
          taxTypeId: icmsExclusive.id,
          categoryId: null,
          productId: product.id,
          rate: 0,
          note: "ICMS-ST recolhido pelo fabricante",
        },
      ],
    });

    const [item] = result.items;
    expect(item.taxes).toHaveLength(1);
    expect(item.taxes[0].rateApplied).toBe(0);
    expect(item.taxes[0].rateSource).toBe("product");
    expect(item.taxes[0].note).toBe("ICMS-ST recolhido pelo fabricante");
    expect(fixed6(item.lineTotal)).toBe("100.000000");
    expect(fixed6(result.total)).toBe("100.000000");
  });

  // Alíquota 0 vinda do padrão da organização não gera linha: não incide e não
  // é override explícito (briefing §7.3, ponto 2). Achado da revisão: essa
  // ausência tem que valer também para o unitário exibido — um tributo que
  // nem aparece no documento não pode redefinir `unitBaseDisplay`.
  it("alíquota 0 do padrão da organização não imprime linha nem afeta o unitário exibido", () => {
    const result = calculate({ taxTypes: [ipiInclusive] });
    expect(result.items[0].taxes).toHaveLength(0);
    expect(fixed6(result.items[0].unitBaseDisplay)).toBe("100.000000");
  });

  // Espelha T-04, mas o override de rate 0 é de CATEGORIA, não de produto —
  // achado da revisão: o filtro antigo só preservava a nota para override de
  // produto e descartava a linha (e a nota) quando o override zerado vinha da
  // categoria, apagando a justificativa de ST para todo produto daquela
  // categoria.
  it("override de categoria com rate 0 (ST) também gera linha e preserva a nota", () => {
    const result = calculate({
      taxTypes: [icmsExclusive],
      overrides: [
        {
          taxTypeId: icmsExclusive.id,
          categoryId: CATEGORY_ID,
          productId: null,
          rate: 0,
          note: "ICMS-ST recolhido pelo fabricante",
        },
      ],
    });

    const [item] = result.items;
    expect(item.taxes).toHaveLength(1);
    expect(item.taxes[0].rateApplied).toBe(0);
    expect(item.taxes[0].rateSource).toBe("category");
    expect(item.taxes[0].note).toBe("ICMS-ST recolhido pelo fabricante");
    expect(fixed6(item.lineTotal)).toBe("100.000000");
  });

  // T-10: tributo inativo não entra no laço.
  it("tributo inativo não gera linha de snapshot", () => {
    const result = calculate({ taxTypes: [{ ...icmsExclusive, active: false }] });
    expect(result.items[0].taxes).toHaveLength(0);
    expect(fixed6(result.total)).toBe("100.000000");
  });

  // T-16: cálculo POR LINHA, nunca por unidade arredondada. O total fecha nas
  // duas estratégias — só a base denuncia o erro.
  it("7 unidades com inclusive 5%: base calculada por linha, não por unidade", () => {
    const result = calculate({
      items: [{ productId: product.id, quantity: 7 }],
      taxTypes: [ipiInclusive],
      overrides: [
        {
          taxTypeId: ipiInclusive.id,
          categoryId: CATEGORY_ID,
          productId: null,
          rate: 5,
          note: null,
        },
      ],
    });

    const [tax] = result.items[0].taxes;
    expect(fixed6(tax.baseAmount)).toBe("666.666667");
    expect(fixed6(tax.taxAmount)).toBe("33.333333");
    expect(fixed6(tax.baseAmount.plus(tax.taxAmount))).toBe("700.000000");
    expect(fixed6(result.total)).toBe("700.000000");
  });

  // T-08: produto sem categoria pula o nível de categoria.
  it("produto sem categoria cai no padrão da organização", () => {
    const result = calculate({
      items: [{ productId: productWithoutCategory.id, quantity: 1 }],
      taxTypes: [icmsExclusive],
      overrides: [
        {
          taxTypeId: icmsExclusive.id,
          categoryId: CATEGORY_ID,
          productId: null,
          rate: 25,
          note: null,
        },
      ],
    });

    expect(result.items[0].taxes[0].rateApplied).toBe(18);
    expect(result.items[0].taxes[0].rateSource).toBe("org_default");
    expect(result.items[0].categoryName).toBeNull();
  });

  // §11.5: a categoria vai para o snapshot do item.
  it("copia o nome da categoria para o item, para o snapshot não depender do produto", () => {
    const result = calculate({ taxTypes: [] });
    expect(result.items[0].categoryId).toBe(CATEGORY_ID);
    expect(result.items[0].categoryName).toBe("Ferramentas");
  });

  // Regressão do bug encontrado na revisão: um segundo tributo `inclusive`
  // com alíquota 0 do padrão da organização (não registrado, sem linha no
  // documento) não pode sobrescrever `unitBaseDisplay` do tributo que É
  // registrado — em nenhuma ordem de `display_order`.
  it("tributo inclusive não registrado não sobrescreve o unitário exibido, em nenhuma ordem", () => {
    const ipiZerado: TaxType = { ...ipiInclusive, id: "tax_outro_inclusive", code: "OUTRO" };
    const overrides: TaxRateOverride[] = [
      { taxTypeId: ipiInclusive.id, categoryId: CATEGORY_ID, productId: null, rate: 5, note: null },
    ];

    const before = calculate({
      taxTypes: [{ ...ipiInclusive, displayOrder: 1 }, { ...ipiZerado, displayOrder: 2 }],
      overrides,
    });
    const after = calculate({
      taxTypes: [{ ...ipiZerado, displayOrder: 1 }, { ...ipiInclusive, displayOrder: 2 }],
      overrides,
    });

    expect(before.items[0].taxes).toHaveLength(1);
    expect(fixed6(before.items[0].unitBaseDisplay)).toBe("95.238095");
    expect(fixed6(after.items[0].unitBaseDisplay)).toBe("95.238095");
  });

  // T-11/T-12: não cumulativo — trocar display_order não muda nenhum número.
  it("é comutativo: inverter display_order não altera nenhum valor", () => {
    const overrides: TaxRateOverride[] = [
      { taxTypeId: ipiInclusive.id, categoryId: CATEGORY_ID, productId: null, rate: 5, note: null },
    ];

    const direct = calculate({ taxTypes: [icmsExclusive, ipiInclusive], overrides });
    const inverted = calculate({
      taxTypes: [
        { ...ipiInclusive, displayOrder: 1 },
        { ...icmsExclusive, displayOrder: 2 },
      ],
      overrides,
    });

    expect(fixed6(inverted.total)).toBe(fixed6(direct.total));
    expect(fixed6(inverted.exclusiveTaxTotal)).toBe(fixed6(direct.exclusiveTaxTotal));
    expect(fixed6(inverted.inclusiveTaxTotal)).toBe(fixed6(direct.inclusiveTaxTotal));
  });

  // T-18: soma em 6 casas e arredonda depois — somar arredondado diverge centavo.
  it("soma o documento em 6 casas antes de arredondar", () => {
    const result = calculate({
      items: [
        { productId: product.id, quantity: 3 },
        { productId: productWithoutCategory.id, quantity: 3 },
      ],
      taxTypes: [ipiInclusive],
      overrides: [
        {
          taxTypeId: ipiInclusive.id,
          categoryId: CATEGORY_ID,
          productId: null,
          rate: 5,
          note: null,
        },
      ],
    });

    expect(fixed6(result.subtotal)).toBe("450.000000");
    expect(fixed6(result.inclusiveTaxTotal)).toBe("14.285714");
  });

  it("recusa produto que não está no catálogo da organização", () => {
    expect(() => calculate({ items: [{ productId: "prd_inexistente", quantity: 1 }] })).toThrow(
      QuoteCalculationError,
    );
  });

  it("recusa quantidade zero ou negativa", () => {
    expect(() => calculate({ items: [{ productId: product.id, quantity: 0 }] })).toThrow(
      QuoteCalculationError,
    );
  });
});

describe("desconto negociado", () => {
  it("percentual incide sobre subtotal + impostos por fora", () => {
    const result = calculate({
      taxTypes: [icmsExclusive],
      discount: { type: "percent", value: 10 },
    });

    // 100 + 18 = 118; 10% = 11,80
    expect(fixed6(result.discountAmount)).toBe("11.800000");
    expect(fixed6(result.total)).toBe("106.200000");
  });

  it("valor fixo maior que o orçamento é limitado ao total, sem total negativo", () => {
    const result = calculate({ discount: { type: "fixed", value: 500 } });
    expect(fixed6(result.discountAmount)).toBe("100.000000");
    expect(fixed6(result.total)).toBe("0.000000");
  });
});

describe("condição de pagamento e faixa de valor", () => {
  it("aplica o desconto da condição sobre o valor já descontado", () => {
    const result = calculate({
      discount: { type: "fixed", value: 20 },
      paymentConditionId: conditionAVista.id,
      paymentConditions: [conditionAVista, conditionBoleto],
      paymentValueBands: bands,
    });

    // 100 − 20 = 80; 5% de 80 = 4,00
    expect(fixed6(result.bandBaseAmount)).toBe("80.000000");
    expect(result.band?.label).toBe("Até R$ 5.000,00");
    expect(fixed6(result.paymentDiscountAmount)).toBe("4.000000");
    expect(fixed6(result.total)).toBe("76.000000");
  });

  it("maxValue é exclusivo: 5.000,00 exatos caem na faixa de cima", () => {
    expect(resolveValueBand(bands, new Decimal(4999.99))?.label).toBe("Até R$ 5.000,00");
    expect(resolveValueBand(bands, new Decimal(5000))?.label).toBe("Acima de R$ 5.000,00");
  });

  it("condição não liberada pela faixa não recebe desconto e é sinalizada", () => {
    const result = calculate({
      items: [{ productId: product.id, quantity: 60 }],
      paymentConditionId: conditionAVista.id,
      paymentConditions: [conditionAVista, conditionBoleto],
      paymentValueBands: bands,
    });

    expect(result.band?.label).toBe("Acima de R$ 5.000,00");
    expect(result.paymentConditionAllowed).toBe(false);
    expect(fixed6(result.paymentDiscountAmount)).toBe("0.000000");
    expect(fixed6(result.total)).toBe("6000.000000");
  });

  it("sem faixa configurada, toda condição ativa vale", () => {
    const result = calculate({
      paymentConditionId: conditionAVista.id,
      paymentConditions: [conditionAVista],
      paymentValueBands: [],
    });

    expect(result.band).toBeNull();
    expect(result.paymentConditionAllowed).toBe(true);
    expect(fixed6(result.paymentDiscountAmount)).toBe("5.000000");
  });

  it("condição inativa não é resolvida", () => {
    const result = calculate({
      paymentConditionId: conditionAVista.id,
      paymentConditions: [{ ...conditionAVista, active: false }],
    });

    expect(result.paymentCondition).toBeNull();
    expect(result.paymentConditionAllowed).toBe(false);
    expect(fixed6(result.total)).toBe("100.000000");
  });

  it("lista só as condições liberadas pela faixa do valor", () => {
    const available = availablePaymentConditions(
      [conditionAVista, conditionBoleto],
      bands,
      new Decimal(6000),
    );
    expect(available.map((condition) => condition.id)).toEqual([conditionBoleto.id]);
  });
});

describe("numeração sequencial", () => {
  it("formata a sequência da organização com quatro dígitos", () => {
    expect(formatQuoteNumber(1)).toBe("ORC-0001");
    expect(formatQuoteNumber(128)).toBe("ORC-0128");
    expect(formatQuoteNumber(12345)).toBe("ORC-12345");
  });
});
