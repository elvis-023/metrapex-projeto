import type { CatalogPreviewRow, OnboardingState, TaxTemplateId } from "@/lib/onboarding/types";

export const STORAGE_KEY = "metrapex:onboarding";

export type TaxTemplateOption = {
  id: TaxTemplateId;
  label: string;
  description: string;
  helpText: string;
};

export const taxTemplateOptions: TaxTemplateOption[] = [
  {
    id: "simples",
    label: "Simples Nacional (sem destaque)",
    description: "Nenhum tributo é destacado no orçamento. Só o rodapé informativo aparece.",
    helpText: "Ideal para MEI e Simples Nacional que não destaca imposto no documento.",
  },
  {
    id: "isento",
    label: "Isento",
    description: "Nenhum tributo, nenhum rodapé. Orçamento limpo, sem qualquer linha de imposto.",
    helpText: "Serve para serviço não tributado no destaque, venda interna ou teste do produto.",
  },
  {
    id: "icms-ipi",
    label: "ICMS + IPI padrão",
    description: "ICMS por fora no padrão da empresa, IPI embutido por categoria.",
    helpText:
      "Revenda no Lucro Presumido — confirme as alíquotas com seu contador antes de emitir.",
  },
];

export const defaultFooterTextByTemplate: Record<TaxTemplateId, string> = {
  simples: "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
  isento: "",
  "icms-ipi": "",
};

export type PaymentConditionOption = {
  id: string;
  label: string;
  detail: string;
};

export const paymentConditionOptions: PaymentConditionOption[] = [
  {
    id: "a-vista",
    label: "À vista (PIX ou dinheiro)",
    detail: "5% de desconto, sem parcelamento.",
  },
  {
    id: "cartao",
    label: "Cartão de crédito",
    detail: "Sem desconto, parcelamento em até 3x sem juros.",
  },
  {
    id: "boleto",
    label: "Boleto",
    detail: "Sem desconto, vencimento em 15 dias. Aplica-se a partir de R$ 500,00.",
  },
];

export const defaultPaymentNote =
  "Faixa acima de R$ 5.000,00 libera parcelamento em até 3x no boleto, mediante aprovação de crédito.";

export const sampleUploadRows: CatalogPreviewRow[] = [
  { row: 2, code: "PRD-001", name: "Cimento CP-II 50kg", price: "R$ 34,90", status: "ok" },
  { row: 3, code: "PRD-002", name: "Argamassa ACIII 20kg", price: "R$ 22,50", status: "ok" },
  { row: 4, code: "PRD-003", name: "Vergalhão 10mm 12m", price: "R$ 58,00", status: "ok" },
  {
    row: 5,
    code: "PRD-003",
    name: "Vergalhão 10mm 12m (duplicado)",
    price: "R$ 58,00",
    status: "erro",
    error: "Código externo duplicado na planilha.",
  },
  {
    row: 6,
    code: "PRD-004",
    name: "Telha cerâmica",
    price: "1250",
    status: "erro",
    error: "Preço mal formatado — use vírgula para centavos (ex.: 12,50).",
  },
  {
    row: 7,
    code: "",
    name: "Tijolo baiano 9 furos",
    price: "R$ 1,20",
    status: "erro",
    error: "Código externo obrigatório.",
  },
];

export const initialOnboardingState: OnboardingState = {
  step: 1,
  furthestStepReached: 1,
  organization: {
    name: "",
    document: "",
    segment: "",
  },
  taxTemplate: {
    templateId: "icms-ipi",
    icmsRate: "18,00",
    ipiCategoryRate: "5,00",
    footerText: defaultFooterTextByTemplate["icms-ipi"],
  },
  catalog: {
    mode: "upload",
    fileName: null,
    rows: [],
    manualProductName: "",
    manualProductPrice: "",
  },
  payment: {
    conditionId: "a-vista",
    note: defaultPaymentNote,
  },
  snippet: {
    copied: false,
  },
  createdOrg: null,
};
