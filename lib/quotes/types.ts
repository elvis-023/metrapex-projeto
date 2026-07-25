import type { RateSource, TaxMode } from "@/lib/quotes/tax-engine";

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

/**
 * `unitPrice`/`catalogLineTotal`/`lineTotal` são `number` só porque este
 * milestone é UI com dados mockados — mesma ressalva de
 * `lib/catalog/types.ts`. O motor de orçamento real (Milestone 14) define
 * a precisão (`numeric(18,6)`, ver briefing §3).
 */
export type QuoteLineItem = {
  productId: string;
  externalCode: string;
  name: string;
  photoUrl: string | null;
  unitPrice: number;
  quantity: number;
  catalogLineTotal: number;
  taxes: QuoteItemTax[];
  lineTotal: number;
};

export type QuoteDiscount = {
  type: "fixed" | "percent";
  /** R$ quando `type` é "fixed"; pontos percentuais (0-100) quando "percent". */
  value: number;
};

export type QuoteDraft = {
  number: string;
  revision: number;
  sourceQuoteId?: string;
  customerId: string | null;
  items: QuoteLineItem[];
  discount: QuoteDiscount;
  paymentConditionId: string;
};
