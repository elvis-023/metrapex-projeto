import { emptyAddress } from "@/lib/public-form/types";
import type { OnboardingState, TaxRegime } from "@/lib/onboarding/types";

// Versionada: mudar o formato de `OnboardingState` (ex.: `organization.address`,
// remover o passo Catálogo, ou trocar `payment.conditionId` por
// `conditionIds[]`) exige trocar o sufixo — senão um `sessionStorage` salvo
// com o schema antigo sobrevive à mudança e quebra a tela mesmo com o merge
// defensivo de `loadInitialState` (onboarding-wizard.tsx).
export const STORAGE_KEY = "metrapex:onboarding:v4";

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

/**
 * Passo 3 do onboarding (Pagamento) — itens marcáveis (checkbox), não mais
 * seleção única. `id` é a chave estável usada em `payment.conditionIds` e
 * repassada a `applyPaymentDefaultsAction` (lib/tax-engine/actions.ts) — só
 * as opções marcadas são gravadas em `payment_conditions`. Renomear `label`
 * aqui não muda `id`/`key` nem o `kind` (mecanismo real do pagamento,
 * ver lib/quotes/payment-defaults.ts) — só o nome exibido.
 */
export const paymentConditionOptions: PaymentConditionOption[] = [
  {
    id: "a-vista",
    label: "À vista antecipado",
    detail: "Com desconto",
  },
  {
    id: "cartao",
    label: "Cartão de crédito",
    detail: "Parcelamento em até x vezes com juros ou sem",
  },
  {
    id: "boleto",
    label: "Faturado para Empresas",
    detail: "Após a aprovação do cadastro",
  },
];

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
    // As 3 vêm marcadas por padrão — preserva o comportamento de sempre
    // gravar as 3 condições (antes disso não depender de fato da tela,
    // ver applyPaymentDefaultsAction); o cliente desmarca o que não usa.
    conditionIds: paymentConditionOptions.map((option) => option.id),
  },
  snippet: {
    copied: false,
  },
  createdOrg: null,
};
