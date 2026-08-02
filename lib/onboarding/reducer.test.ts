import { describe, expect, it } from "vitest";

import { initialOnboardingState } from "@/lib/onboarding/mock-data";
import { isStepValid, onboardingReducer } from "@/lib/onboarding/reducer";
import { ONBOARDING_STEPS, type OnboardingState } from "@/lib/onboarding/types";
import { emptyAddress } from "@/lib/public-form/types";

/**
 * Passo 1 do onboarding — autofill de organização a partir do CNPJ
 * (components/onboarding/step-organization.tsx), reaproveitando o mesmo
 * client de consulta do formulário público. Cobre exatamente os critérios
 * verificados manualmente: preencher, editar depois de preenchido, e o erro
 * de CNPJ não encontrado.
 */
describe("onboardingReducer — autofill de organização por CNPJ", () => {
  it("LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS preenche nome e endereço, e marca status 'done'", () => {
    const address = { ...emptyAddress, street: "Avenida Paulista", city: "São Paulo", state: "SP" };
    const next = onboardingReducer(initialOnboardingState, {
      type: "LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS",
      legalName: "Empresa Teste LTDA",
      address,
    });
    expect(next.organization.name).toBe("Empresa Teste LTDA");
    expect(next.organization.address).toEqual(address);
    expect(next.organization.documentLookupStatus).toBe("done");
  });

  it("LOOKUP_ORGANIZATION_DOCUMENT_ERROR marca status 'error', sem alterar os dados já digitados", () => {
    const withDocument = onboardingReducer(initialOnboardingState, {
      type: "SET_ORGANIZATION_DOCUMENT",
      digits: "11111111111111",
    });
    const next = onboardingReducer(withDocument, { type: "LOOKUP_ORGANIZATION_DOCUMENT_ERROR" });
    expect(next.organization.documentLookupStatus).toBe("error");
    expect(next.organization.document).toBe("11111111111111");
  });

  it("campos preenchidos automaticamente continuam editáveis (SET_ORGANIZATION_NAME / SET_ORGANIZATION_ADDRESS_FIELD)", () => {
    const filled = onboardingReducer(initialOnboardingState, {
      type: "LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS",
      legalName: "Empresa Teste LTDA",
      address: { ...emptyAddress, street: "Avenida Paulista" },
    });
    const editedName = onboardingReducer(filled, {
      type: "SET_ORGANIZATION_NAME",
      value: "Nome ajustado pelo usuário",
    });
    const editedStreet = onboardingReducer(editedName, {
      type: "SET_ORGANIZATION_ADDRESS_FIELD",
      field: "street",
      value: "Rua ajustada pelo usuário",
    });
    expect(editedStreet.organization.name).toBe("Nome ajustado pelo usuário");
    expect(editedStreet.organization.address.street).toBe("Rua ajustada pelo usuário");
  });

  it("trocar o documento depois de um preenchimento automático limpa nome e endereço (mesmo desenho de SET_DOCUMENT)", () => {
    const filled = onboardingReducer(initialOnboardingState, {
      type: "LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS",
      legalName: "Empresa Teste LTDA",
      address: { ...emptyAddress, street: "Avenida Paulista" },
    });
    const redocumented = onboardingReducer(filled, {
      type: "SET_ORGANIZATION_DOCUMENT",
      digits: "22222222222222",
    });
    expect(redocumented.organization.name).toBe("");
    expect(redocumented.organization.address).toEqual(emptyAddress);
    expect(redocumented.organization.documentLookupStatus).toBe("idle");
  });

  it("estado inicial não tem mais campo de segmento", () => {
    expect(initialOnboardingState.organization).not.toHaveProperty("segment");
  });
});

/**
 * Bloco 7 — sugestão de regime pré-marcada no passo 2 (detecção automática
 * por CNPJ). `autoDetected` controla o badge "Detectado pelo CNPJ" em
 * step-tax-regime.tsx: só a sugestão automática liga o badge, e qualquer
 * escolha manual do usuário desliga, mesmo que caia no mesmo regime.
 */
describe("onboardingReducer — SET_TAX_REGIME_SUGGESTION / SET_TAX_REGIME", () => {
  it("SET_TAX_REGIME_SUGGESTION marca regime e autoDetected=true", () => {
    const next = onboardingReducer(initialOnboardingState, {
      type: "SET_TAX_REGIME_SUGGESTION",
      regime: "mei",
    });
    expect(next.taxRegime.regime).toBe("mei");
    expect(next.taxRegime.autoDetected).toBe(true);
  });

  it("SET_TAX_REGIME (escolha manual) sempre marca autoDetected=false", () => {
    const next = onboardingReducer(initialOnboardingState, {
      type: "SET_TAX_REGIME",
      regime: "lucro_real",
    });
    expect(next.taxRegime.regime).toBe("lucro_real");
    expect(next.taxRegime.autoDetected).toBe(false);
  });

  it("escolha manual depois de uma sugestão derruba autoDetected, mesmo regime igual", () => {
    const suggested = onboardingReducer(initialOnboardingState, {
      type: "SET_TAX_REGIME_SUGGESTION",
      regime: "simples_nacional",
    });
    const confirmed = onboardingReducer(suggested, {
      type: "SET_TAX_REGIME",
      regime: "simples_nacional",
    });
    expect(confirmed.taxRegime.regime).toBe("simples_nacional");
    expect(confirmed.taxRegime.autoDetected).toBe(false);
  });

  it("SET_TAX_REGIME_SUGGESTION também atualiza o rodapé padrão do regime sugerido", () => {
    const next = onboardingReducer(initialOnboardingState, {
      type: "SET_TAX_REGIME_SUGGESTION",
      regime: "mei",
    });
    expect(next.taxRegime.footerText).toBe(
      "Valor aproximado dos tributos incidentes conforme Lei 12.741/2012.",
    );
  });
});

/**
 * Passo Catálogo removido do wizard por completo — sobram 4 passos:
 * Organização, Regime Tributário, Pagamento (era 4, agora 3) e Snippet (era
 * 5, agora 4). Cobre exatamente o que foi verificado manualmente: a barra de
 * progresso bate com o número real de passos, e navegar (NEXT/BACK/SKIP/
 * JUMP_TO) funciona do primeiro ao último passo sem "buraco" no lugar do
 * catálogo removido.
 */
describe("onboardingReducer — navegação após remover o passo Catálogo", () => {
  it("ONBOARDING_STEPS tem 4 passos, sem 'Catálogo'", () => {
    expect(ONBOARDING_STEPS).toHaveLength(4);
    expect(ONBOARDING_STEPS.map((s) => s.label)).toEqual([
      "Organização",
      "Regime Tributário",
      "Pagamento",
      "Snippet",
    ]);
  });

  it("NEXT avança do passo 1 até o passo 4 (último), sem passar por um 5º passo", () => {
    let state = initialOnboardingState;
    for (let i = 0; i < 5; i++) {
      state = onboardingReducer(state, { type: "NEXT" });
    }
    expect(state.step).toBe(4);
    expect(state.furthestStepReached).toBe(4);
  });

  it("BACK volta do último passo (4) até o primeiro, sem passar de 1", () => {
    let state: OnboardingState = { ...initialOnboardingState, step: 4, furthestStepReached: 4 };
    for (let i = 0; i < 5; i++) {
      state = onboardingReducer(state, { type: "BACK" });
    }
    expect(state.step).toBe(1);
  });

  it("SKIP também respeita o novo limite de 4 passos", () => {
    let state = initialOnboardingState;
    for (let i = 0; i < 5; i++) {
      state = onboardingReducer(state, { type: "SKIP" });
    }
    expect(state.step).toBe(4);
  });

  it("JUMP_TO só permite ir a um passo já alcançado, dentro do 1..4", () => {
    const state: OnboardingState = { ...initialOnboardingState, step: 1, furthestStepReached: 2 };
    const jumpedAhead = onboardingReducer(state, { type: "JUMP_TO", step: 4 });
    expect(jumpedAhead.step).toBe(1);

    const jumpedBack = onboardingReducer(state, { type: "JUMP_TO", step: 2 });
    expect(jumpedBack.step).toBe(2);
  });

  it("isStepValid: passo 3 agora é Pagamento (exige condição escolhida), passo 4 é Snippet (sempre válido)", () => {
    expect(isStepValid(initialOnboardingState, 3)).toBe(true);
    expect(
      isStepValid({ ...initialOnboardingState, payment: { conditionIds: [], note: "" } }, 3),
    ).toBe(false);
    expect(isStepValid(initialOnboardingState, 4)).toBe(true);
  });
});

/**
 * Passo 3 (Pagamento) virou checkbox — marca/desmarca livremente, em vez da
 * seleção única de antes. Por padrão as 3 condições vêm marcadas (decisão
 * confirmada com o usuário: preserva o comportamento de sempre gravar as 3
 * condições que já existia no back-end antes desta mudança).
 */
describe("onboardingReducer — condições de pagamento selecionáveis (checkbox)", () => {
  it("estado inicial vem com as 3 condições marcadas", () => {
    expect(initialOnboardingState.payment.conditionIds).toEqual(["a-vista", "cartao", "boleto"]);
  });

  it("TOGGLE_PAYMENT_CONDITION desmarca uma condição já marcada", () => {
    const next = onboardingReducer(initialOnboardingState, {
      type: "TOGGLE_PAYMENT_CONDITION",
      conditionId: "boleto",
    });
    expect(next.payment.conditionIds).toEqual(["a-vista", "cartao"]);
  });

  it("TOGGLE_PAYMENT_CONDITION marca de novo uma condição desmarcada", () => {
    const unmarked = onboardingReducer(initialOnboardingState, {
      type: "TOGGLE_PAYMENT_CONDITION",
      conditionId: "boleto",
    });
    const remarked = onboardingReducer(unmarked, {
      type: "TOGGLE_PAYMENT_CONDITION",
      conditionId: "boleto",
    });
    expect(remarked.payment.conditionIds).toEqual(["a-vista", "cartao", "boleto"]);
  });

  it("desmarcar todas as condições invalida o passo 3 (isStepValid)", () => {
    let state = initialOnboardingState;
    for (const id of ["a-vista", "cartao", "boleto"]) {
      state = onboardingReducer(state, { type: "TOGGLE_PAYMENT_CONDITION", conditionId: id });
    }
    expect(state.payment.conditionIds).toEqual([]);
    expect(isStepValid(state, 3)).toBe(false);
  });
});
