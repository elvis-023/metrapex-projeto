import { emptyAddress } from "@/lib/public-form/types";
import type { OnboardingState, TaxRegime } from "@/lib/onboarding/types";

// Versionada: mudar o formato de `OnboardingState` (ex.: `organization.address`,
// ou remover o passo Catálogo — `step`/`furthestStepReached` armazenados como
// 5 não existem mais) exige trocar o sufixo — senão um `sessionStorage` salvo
// com o schema antigo sobrevive à mudança e quebra a tela mesmo com o merge
// defensivo de `loadInitialState` (onboarding-wizard.tsx).
export const STORAGE_KEY = "metrapex:onboarding:v3";

export type TaxRegimeOption = {
  /** Valor gravado em `organizations.tax_regime` ao selecionar este card. */
  id: TaxRegime;
  /**
   * Todo valor de `tax_regime` que conta como "este card selecionado" — usado
   * pra destacar o card e pro badge de detecção automática. Lucro Presumido e
   * Lucro Real são um único card na tela (decisão "Regime Tributário
   * unificação onboarding": banco continua com os 2 valores, ver
   * lib/tax-engine/onboarding-templates.ts; a tela só une visualmente e
   * sempre grava `id`, nunca `lucro_real`, diretamente).
   */
  matches: TaxRegime[];
  label: string;
  description: string;
  helpText: string;
};

/**
 * As 3 opções do passo 2 (briefing §6). "Isento" não é regime — deixou de
 * aparecer aqui, fica só como ajuste manual em Configurações > Impostos.
 */
export const taxRegimeOptions: TaxRegimeOption[] = [
  {
    id: "mei",
    matches: ["mei"],
    label: "MEI",
    description: "Nenhum tributo é destacado — o imposto já está dentro do DAS.",
    helpText: "Ideal para MEI: o orçamento sai limpo, só com a nota da Lei 12.741/2012.",
  },
  {
    id: "simples_nacional",
    matches: ["simples_nacional"],
    label: "Simples Nacional",
    description: "Nenhum tributo é destacado, como no MEI.",
    helpText:
      "Cobre a maioria das empresas do Simples. Se sua atividade destaca algum tributo específico, isso é ajuste manual depois em Configurações.",
  },
  {
    id: "lucro_presumido",
    matches: ["lucro_presumido", "lucro_real"],
    label: "Lucro Presumido ou Lucro Real",
    description: "ICMS por fora no padrão da empresa; IPI configurável por categoria.",
    helpText:
      "Revenda comum fora do Simples — a diferença entre os dois está na apuração de impostos da empresa, não no que aparece pro cliente no orçamento. Confirme com o contador qual dos dois é o seu caso; o ajuste fino de ICMS por estado fica em Configurações > Impostos.",
  },
];

export const defaultFooterTextByRegime: Record<TaxRegime, string> = {
  mei: "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
  simples_nacional: "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
  lucro_presumido: "",
  lucro_real: "",
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

export const initialOnboardingState: OnboardingState = {
  step: 1,
  furthestStepReached: 1,
  organization: {
    name: "",
    document: "",
    address: emptyAddress,
    documentLookupStatus: "idle",
    cepLookupStatus: "idle",
  },
  taxRegime: {
    regime: "lucro_presumido",
    icmsRate: "18,00",
    ipiCategoryRate: "5,00",
    footerText: defaultFooterTextByRegime.lucro_presumido,
    autoDetected: false,
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
