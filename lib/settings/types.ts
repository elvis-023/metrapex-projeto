import type { RateSource, TaxMode } from "@/lib/supabase/types";

export type { TaxMode, RateSource };

export type TaxTypeSetting = {
  id: string;
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;
};

export type TaxOverrideScope = "category" | "product";

export type TaxRateOverrideSetting = {
  id: string;
  taxTypeId: string;
  scope: TaxOverrideScope;
  categoryId: string | null;
  productId: string | null;
  rate: number;
  note: string | null;
};

export type PaymentMethodKind = "a_vista" | "cartao" | "boleto";

export type PaymentCondition = {
  id: string;
  label: string;
  kind: PaymentMethodKind;
  /** Pontos percentuais de desconto, 0 se não houver. */
  discountPercent: number;
  /** 1 = sem parcelamento. */
  installments: number;
  /** Prazo de vencimento em dias, 0 = imediato. */
  termDays: number;
  active: boolean;
};

export type PaymentValueBand = {
  id: string;
  label: string;
  minValue: number;
  /** null = sem teto. */
  maxValue: number | null;
  paymentConditionIds: string[];
};

export type PdfTemplateSettings = {
  logoUrl: string | null;
  issuerName: string;
  issuerDocument: string;
  issuerAddress: string;
  warrantyText: string;
  termsText: string;
  shippingText: string;
};

export type TeamRole = "admin" | "vendedor";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  isCurrentUser: boolean;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: TeamRole;
  invitedAt: string;
};

export type PlanTier = {
  id: string;
  name: string;
  priceLabel: string;
  sellerLimit: number;
  monthlyQuoteLimit: number;
  whatsappIncluded: boolean;
};
