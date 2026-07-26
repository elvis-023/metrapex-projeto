import type {
  PaymentConditionKind,
  QuoteDiscountType,
  QuoteStatus,
  RateSource,
  TaxMode,
} from "@/lib/supabase/types";

export type { QuoteDiscountType, QuoteStatus };

/**
 * Tipos de VISÃO. O dinheiro aqui é `number` porque estes objetos só existem
 * para renderizar — `currencyFormatter` já recebeu o valor arredondado em 2
 * casas pelo motor. Nenhum cálculo acontece sobre eles: quem soma, desconta e
 * resolve imposto é `lib/quotes/engine.ts`, sempre em `Decimal`
 * (convenção de dinheiro do briefing §3).
 */
export type QuoteItemTax = {
  taxTypeId: string;
  code: string;
  label: string;
  mode: TaxMode;
  rate: number;
  source: RateSource;
  note: string | null;
  base: number;
  amount: number;
};

export type QuoteLineItem = {
  position: number;
  productId: string;
  externalCode: string;
  name: string;
  photoUrl: string | null;
  unitPrice: number;
  /** Unitário exibido ao cliente — a base, quando há tributo `inclusive`. */
  unitBaseDisplay: number;
  quantity: number;
  taxes: QuoteItemTax[];
  lineTotal: number;
};

export type QuoteDiscount = {
  type: QuoteDiscountType;
  /** R$ quando `type` é "fixed"; pontos percentuais (0-100) quando "percent". */
  value: number;
};

export type QuoteTaxTotalView = {
  code: string;
  label: string;
  mode: TaxMode;
  amount: number;
};

export type QuotePaymentConditionView = {
  id: string;
  label: string;
  kind: PaymentConditionKind;
  discountPercent: number;
  installments: number;
  termDays: number;
  active: boolean;
};

export type QuotePaymentBandView = {
  id: string;
  label: string;
  minValue: number;
  maxValue: number | null;
  paymentConditionIds: string[];
};

/** Resultado do motor pronto para a tela. */
export type QuoteTotalsView = {
  subtotal: number;
  exclusiveTaxTotal: number;
  inclusiveTaxTotal: number;
  taxTotals: QuoteTaxTotalView[];
  discountAmount: number;
  paymentDiscountAmount: number;
  total: number;
  bandLabel: string | null;
  paymentConditionAllowed: boolean;
};

export type QuoteView = QuoteTotalsView & { items: QuoteLineItem[] };

/**
 * Documento lido do banco. `issuedAt` nulo = rascunho, cujos números foram
 * RECALCULADOS com a configuração vigente (§11.3). Preenchido = emitido, e
 * então tudo aqui vem do snapshot congelado — nenhuma linha desta estrutura
 * foi resolvida contra `tax_types`, `tax_rates` ou `payment_conditions`.
 */
export type QuoteDocument = {
  id: string;
  number: string;
  sequence: number;
  revision: number;
  previousRevisionId: string | null;
  supersededByRevisionId: string | null;
  status: QuoteStatus;
  ownerId: string | null;
  customerId: string | null;
  customerName: string;
  customerDocument: string;
  customerSourceId: string | null;
  discount: QuoteDiscount;
  paymentConditionId: string | null;
  paymentConditionLabel: string | null;
  paymentConditionInstallments: number | null;
  paymentConditionTermDays: number | null;
  paymentBandLabel: string | null;
  issuedAt: string | null;
  taxFooterNote: string | null;
  showTaxLines: boolean;
  expiresAt: string | null;
  createdAt: string;
  view: QuoteView;
};
