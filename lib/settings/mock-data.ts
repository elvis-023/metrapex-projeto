import { fakeCurrentOrganization } from "@/lib/mock-data";
import { fakeTaxRateOverrides, fakeTaxTypes } from "@/lib/quotes/mock-data";
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
 * Ponto de partida igual ao usado pelo motor de orçamento
 * (`lib/quotes/mock-data.ts`) — cenário "ICMS + IPI padrão" do briefing §6 —
 * para a tela de configuração editar exatamente o que já resolve as
 * alíquotas mostradas no orçamento manual e no formulário público.
 */
export const initialTaxTypes: TaxTypeSetting[] = fakeTaxTypes.map((taxType) => ({ ...taxType }));

export const initialTaxRateOverrides: TaxRateOverrideSetting[] = fakeTaxRateOverrides.map(
  (override, index) => ({
    id: `tax_override_${index}`,
    taxTypeId: override.taxTypeId,
    scope: override.categoryId ? "category" : "product",
    categoryId: override.categoryId,
    productId: override.productId,
    rate: override.rate,
    note: override.note,
  }),
);

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
    email: "elvis@metrapex-distribuidora.com.br",
    role: "admin",
    isCurrentUser: true,
  },
  {
    id: "member_2",
    name: "Camila Duarte",
    email: "camila@metrapex-distribuidora.com.br",
    role: "vendedor",
    isCurrentUser: false,
  },
  {
    id: "member_3",
    name: "Rafael Souza",
    email: "rafael@metrapex-distribuidora.com.br",
    role: "vendedor",
    isCurrentUser: false,
  },
];

export const initialTeamInvites: TeamInvite[] = [
  {
    id: "invite_1",
    email: "novo.vendedor@metrapex-distribuidora.com.br",
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
