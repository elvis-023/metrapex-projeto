import { describe, expect, it } from "vitest";

import { initialOnboardingState } from "@/lib/onboarding/mock-data";
import { onboardingReducer } from "@/lib/onboarding/reducer";

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
