import { fakeCurrentOrganization } from "@/lib/mock-data";
import type {
  PaymentCondition,
  PaymentValueBand,
  PdfTemplateSettings,
  PlanTier,
  TaxRateOverrideSetting,
  TaxTypeSetting,
  TeamInvite,
  TeamMember,
} from "@/lib/settings/types";

/**
 * Fixture da TELA de configuração (Milestone 10, ainda sem persistência) —
 * cenário "ICMS + IPI padrão" do briefing §6. O motor de orçamento não lê
 * daqui desde a Milestone 14: ele resolve alíquota contra `tax_types` /
 * `tax_rates` no banco. Estes valores só existem para a tela ter o que
 * mostrar até o backend de configuração fiscal ser ligado.
 */
export const initialTaxTypes: TaxTypeSetting[] = [
  { id: "tax_icms", code: "ICMS", label: "ICMS", mode: "exclusive", defaultRate: 18 },
  { id: "tax_ipi", code: "IPI", label: "IPI", mode: "inclusive", defaultRate: 0 },
];

export const initialTaxRateOverrides: TaxRateOverrideSetting[] = [
  {
    id: "tax_override_0",
    taxTypeId: "tax_ipi",
    scope: "category",
    categoryId: "cat_ferramentas",
    productId: null,
    rate: 5,
    note: null,
  },
  {
    id: "tax_override_1",
    taxTypeId: "tax_icms",
    scope: "product",
    categoryId: null,
    productId: "prd_4",
    rate: 0,
    note: "ICMS-ST recolhido pelo fabricante",
  },
];

export const initialPaymentConditions: PaymentCondition[] = [
  {
    id: "cond_a-vista",
    label: "À vista (PIX ou dinheiro)",
    kind: "a_vista",
    discountPercent: 5,
    installments: 1,
    termDays: 0,
    active: true,
  },
  {
    id: "cond_cartao",
    label: "Cartão de crédito",
    kind: "cartao",
    discountPercent: 0,
    installments: 3,
    termDays: 0,
    active: true,
  },
  {
    id: "cond_boleto",
    label: "Boleto",
    kind: "boleto",
    discountPercent: 0,
    installments: 1,
    termDays: 15,
    active: true,
  },
];

export const initialPaymentValueBands: PaymentValueBand[] = [
  {
    id: "band_ate-5000",
    label: "Até R$ 5.000,00",
    minValue: 0,
    maxValue: 5000,
    paymentConditionIds: ["cond_a-vista", "cond_cartao", "cond_boleto"],
  },
  {
    id: "band_acima-5000",
    label: "Acima de R$ 5.000,00",
    minValue: 5000,
    maxValue: null,
    paymentConditionIds: ["cond_boleto"],
  },
];

export const initialPdfTemplate: PdfTemplateSettings = {
  logoUrl: null,
  issuerName: fakeCurrentOrganization.name,
  issuerDocument: "12.345.678/0001-90",
  issuerAddress: "Av. Industrial, 1200 — Distrito Industrial, São Paulo/SP",
  warrantyText: "Garantia de 90 dias contra defeito de fabricação, conforme nota fiscal.",
  termsText:
    "Orçamento válido por 15 dias. Preços sujeitos a alteração sem aviso prévio após o vencimento.",
  shippingText: "Frete não incluso — calculado conforme CEP de entrega no fechamento do pedido.",
};

export const initialTeamMembers: TeamMember[] = [
  {
    id: "member_1",
    name: "Elvis Ugwu",
    email: "elvis@trezofy-distribuidora.com.br",
    role: "admin",
    isCurrentUser: true,
  },
  {
    id: "member_2",
    name: "Camila Duarte",
    email: "camila@trezofy-distribuidora.com.br",
    role: "vendedor",
    isCurrentUser: false,
  },
  {
    id: "member_3",
    name: "Rafael Souza",
    email: "rafael@trezofy-distribuidora.com.br",
    role: "vendedor",
    isCurrentUser: false,
  },
];

export const initialTeamInvites: TeamInvite[] = [
  {
    id: "invite_1",
    email: "novo.vendedor@trezofy-distribuidora.com.br",
    role: "vendedor",
    invitedAt: "2026-07-20",
  },
];

/** Mesmos nomes de plano usados no dropdown de organização (`lib/mock-data.ts`). */
export const planTiers: PlanTier[] = [
  {
    id: "entrada",
    name: "Entrada",
    priceLabel: "R$ 49/mês",
    sellerLimit: 1,
    monthlyQuoteLimit: 30,
    whatsappIncluded: false,
  },
  {
    id: "profissional",
    name: "Profissional",
    priceLabel: "R$ 149/mês",
    sellerLimit: 5,
    monthlyQuoteLimit: 200,
    whatsappIncluded: true,
  },
  {
    id: "escala",
    name: "Escala",
    priceLabel: "Sob consulta",
    sellerLimit: Infinity,
    monthlyQuoteLimit: Infinity,
    whatsappIncluded: true,
  },
];

export const currentPlan: PlanTier =
  planTiers.find((plan) => plan.name === fakeCurrentOrganization.plan) ?? planTiers[0];
