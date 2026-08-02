import type { PaymentConditionKind } from "@/lib/supabase/types";

/**
 * Sugestão-padrão de condições de pagamento e faixas de valor gravada no
 * passo 4 do onboarding (PLAN.md > Milestone 4: "confirmar condições de
 * pagamento, sugestão-padrão pré-preenchida"). São só valores iniciais — a
 * organização edita tudo depois em `/settings/payment-terms`; o motor de
 * orçamento lê o que estiver no banco, nunca esta constante.
 */
export type PaymentConditionSeed = {
  key: string;
  label: string;
  kind: PaymentConditionKind;
  discountPercent: number;
  installments: number;
  termDays: number;
  displayOrder: number;
};

export const defaultPaymentConditions: PaymentConditionSeed[] = [
  {
    key: "a-vista",
    label: "À vista (PIX ou dinheiro)",
    kind: "a_vista",
    discountPercent: 5,
    installments: 1,
    termDays: 0,
    displayOrder: 1,
  },
  {
    key: "cartao",
    label: "Cartão de crédito",
    kind: "cartao",
    discountPercent: 0,
    installments: 3,
    termDays: 0,
    displayOrder: 2,
  },
  {
    key: "boleto",
    label: "Faturado para Empresas",
    kind: "boleto",
    discountPercent: 0,
    installments: 1,
    termDays: 15,
    displayOrder: 3,
  },
];

export type PaymentBandSeed = {
  label: string;
  minValue: number;
  maxValue: number | null;
  conditionKeys: string[];
};

export const defaultPaymentValueBands: PaymentBandSeed[] = [
  {
    label: "Até R$ 5.000,00",
    minValue: 0,
    maxValue: 5000,
    conditionKeys: ["a-vista", "cartao", "boleto"],
  },
  {
    label: "Acima de R$ 5.000,00",
    minValue: 5000,
    maxValue: null,
    conditionKeys: ["boleto"],
  },
];
