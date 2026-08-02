import type { TaxRegime } from "@/lib/tax-engine/onboarding-templates";
import type { LookupStatus, PublicFormAddress } from "@/lib/public-form/types";

export type { TaxRegime };

export type OnboardingStep = 1 | 2 | 3 | 4;

export const ONBOARDING_STEPS: { step: OnboardingStep; label: string }[] = [
  { step: 1, label: "Organização" },
  { step: 2, label: "Regime Tributário" },
  { step: 3, label: "Pagamento" },
  { step: 4, label: "Snippet" },
];

export type OnboardingState = {
  step: OnboardingStep;
  furthestStepReached: OnboardingStep;
  organization: {
    name: string;
    document: string;
    address: PublicFormAddress;
    /**
     * Estado da consulta automática de CNPJ (BrasilAPI) que preenche `name`
     * (razão social) e `address` — mesmo client de
     * lib/public-form/lookup.ts, reaproveitado aqui (Bloco de onboarding).
     */
    documentLookupStatus: LookupStatus;
    cepLookupStatus: LookupStatus;
  };
  taxRegime: {
    regime: TaxRegime;
    icmsRate: string;
    ipiCategoryRate: string;
    footerText: string;
    /**
     * `true` quando `regime` veio de `SET_TAX_REGIME_SUGGESTION` (detecção
     * automática por CNPJ, Bloco 7) e o usuário ainda não confirmou/trocou
     * manualmente — controla o badge "Detectado automaticamente" no passo 2.
     * Qualquer escolha manual (`SET_TAX_REGIME`) zera este campo.
     */
    autoDetected: boolean;
  };
  payment: {
    conditionId: string;
    note: string;
  };
  snippet: {
    copied: boolean;
  };
  /**
   * Preenchido quando o passo 3 (Pagamento) é concluído — a organização (com
   * tributo e pagamento padrão) já existe de verdade nesse ponto, não só na
   * conclusão do wizard, porque o passo 4 (Snippet) precisa da
   * `publicFormKey` real para montar o snippet. Ver
   * components/onboarding/onboarding-wizard.tsx.
   */
  createdOrg: { orgId: string; slug: string; publicFormKey: string } | null;
};
