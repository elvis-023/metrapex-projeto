export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export const ONBOARDING_STEPS: { step: OnboardingStep; label: string }[] = [
  { step: 1, label: "Organização" },
  { step: 2, label: "Template fiscal" },
  { step: 3, label: "Catálogo" },
  { step: 4, label: "Pagamento" },
  { step: 5, label: "Snippet" },
];

export type TaxTemplateId = "simples" | "isento" | "icms-ipi";

export type CatalogMode = "upload" | "manual";

export type CatalogRowStatus = "ok" | "erro";

export type CatalogPreviewRow = {
  row: number;
  code: string;
  name: string;
  price: string;
  status: CatalogRowStatus;
  error?: string;
};

export type OnboardingState = {
  step: OnboardingStep;
  furthestStepReached: OnboardingStep;
  organization: {
    name: string;
    document: string;
    segment: string;
  };
  taxTemplate: {
    templateId: TaxTemplateId;
    icmsRate: string;
    ipiCategoryRate: string;
    footerText: string;
  };
  catalog: {
    mode: CatalogMode;
    fileName: string | null;
    rows: CatalogPreviewRow[];
    manualProductName: string;
    manualProductPrice: string;
  };
  payment: {
    conditionId: string;
    note: string;
  };
  snippet: {
    copied: boolean;
  };
  /**
   * Preenchido quando o passo 4 é concluído — a organização (com tributo e
   * pagamento padrão) já existe de verdade nesse ponto, não só na conclusão
   * do wizard, porque o passo 5 precisa da `publicFormKey` real para montar
   * o snippet. Ver components/onboarding/onboarding-wizard.tsx.
   */
  createdOrg: { orgId: string; slug: string; publicFormKey: string } | null;
};
