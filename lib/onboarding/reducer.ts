import { defaultFooterTextByRegime } from "@/lib/onboarding/mock-data";
import { emptyAddress, type PublicFormAddress } from "@/lib/public-form/types";
import type { OnboardingState, OnboardingStep, TaxRegime } from "@/lib/onboarding/types";

export type OnboardingAction =
  | { type: "HYDRATE"; state: OnboardingState }
  | { type: "SET_ORGANIZATION_NAME"; value: string }
  | { type: "SET_ORGANIZATION_DOCUMENT"; digits: string }
  | { type: "LOOKUP_ORGANIZATION_DOCUMENT_START" }
  | { type: "LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS"; legalName: string; address: PublicFormAddress }
  | { type: "LOOKUP_ORGANIZATION_DOCUMENT_ERROR" }
  | { type: "SET_ORGANIZATION_ADDRESS_FIELD"; field: keyof PublicFormAddress; value: string }
  | { type: "LOOKUP_ORGANIZATION_CEP_START" }
  | { type: "LOOKUP_ORGANIZATION_CEP_SUCCESS"; address: PublicFormAddress }
  | { type: "LOOKUP_ORGANIZATION_CEP_ERROR" }
  | { type: "SET_TAX_REGIME"; regime: TaxRegime }
  | { type: "SET_TAX_REGIME_SUGGESTION"; regime: TaxRegime }
  | { type: "SET_TAX_FIELD"; field: "icmsRate" | "ipiCategoryRate" | "footerText"; value: string }
  | { type: "TOGGLE_PAYMENT_CONDITION"; conditionId: string }
  | { type: "MARK_SNIPPET_COPIED" }
  | { type: "SET_CREATED_ORG"; org: { orgId: string; slug: string; publicFormKey: string } }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SKIP" }
  | { type: "JUMP_TO"; step: OnboardingStep };

export function isStepValid(state: OnboardingState, step: OnboardingStep): boolean {
  switch (step) {
    case 1:
      return (
        state.organization.name.trim().length > 1 && state.organization.document.trim().length > 0
      );
    case 2:
      return state.taxRegime.regime !== undefined;
    case 3:
      return state.payment.conditionIds.length > 0;
    case 4:
      return true;
    default:
      return true;
  }
}

function clampStep(step: number): OnboardingStep {
  return Math.min(4, Math.max(1, step)) as OnboardingStep;
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "SET_ORGANIZATION_NAME":
      return {
        ...state,
        organization: { ...state.organization, name: action.value },
      };

    case "SET_ORGANIZATION_DOCUMENT": {
      // Mesmo cuidado de SET_DOCUMENT (lib/public-form/reducer.ts): trocar o
      // documento depois de um preenchimento automático invalida os dados
      // que descreviam a empresa anterior.
      const clearAutofilled = state.organization.documentLookupStatus === "done";
      return {
        ...state,
        organization: {
          ...state.organization,
          document: action.digits,
          documentLookupStatus: "idle",
          ...(clearAutofilled ? { name: "", address: emptyAddress } : {}),
        },
      };
    }

    case "LOOKUP_ORGANIZATION_DOCUMENT_START":
      return {
        ...state,
        organization: { ...state.organization, documentLookupStatus: "loading" },
      };

    case "LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS":
      return {
        ...state,
        organization: {
          ...state.organization,
          documentLookupStatus: "done",
          name: action.legalName,
          address: action.address,
        },
      };

    case "LOOKUP_ORGANIZATION_DOCUMENT_ERROR":
      return {
        ...state,
        organization: { ...state.organization, documentLookupStatus: "error" },
      };

    case "SET_ORGANIZATION_ADDRESS_FIELD":
      return {
        ...state,
        organization: {
          ...state.organization,
          address: { ...state.organization.address, [action.field]: action.value },
          // Mesmo desenho de SET_CEP (lib/public-form/reducer.ts): editar o
          // CEP invalida a busca anterior, sem repetir para os demais campos.
          ...(action.field === "zip" ? { cepLookupStatus: "idle" as const } : {}),
        },
      };

    case "LOOKUP_ORGANIZATION_CEP_START":
      return {
        ...state,
        organization: { ...state.organization, cepLookupStatus: "loading" },
      };

    case "LOOKUP_ORGANIZATION_CEP_SUCCESS":
      return {
        ...state,
        organization: {
          ...state.organization,
          cepLookupStatus: "done",
          address: action.address,
        },
      };

    case "LOOKUP_ORGANIZATION_CEP_ERROR":
      return {
        ...state,
        organization: { ...state.organization, cepLookupStatus: "error" },
      };

    case "SET_TAX_REGIME":
      return {
        ...state,
        taxRegime: {
          ...state.taxRegime,
          regime: action.regime,
          footerText: defaultFooterTextByRegime[action.regime],
          autoDetected: false,
        },
      };

    case "SET_TAX_REGIME_SUGGESTION":
      return {
        ...state,
        taxRegime: {
          ...state.taxRegime,
          regime: action.regime,
          footerText: defaultFooterTextByRegime[action.regime],
          autoDetected: true,
        },
      };

    case "SET_TAX_FIELD":
      return {
        ...state,
        taxRegime: { ...state.taxRegime, [action.field]: action.value },
      };

    case "TOGGLE_PAYMENT_CONDITION": {
      const isSelected = state.payment.conditionIds.includes(action.conditionId);
      return {
        ...state,
        payment: {
          ...state.payment,
          conditionIds: isSelected
            ? state.payment.conditionIds.filter((id) => id !== action.conditionId)
            : [...state.payment.conditionIds, action.conditionId],
        },
      };
    }

    case "MARK_SNIPPET_COPIED":
      return { ...state, snippet: { copied: true } };

    case "SET_CREATED_ORG":
      return { ...state, createdOrg: action.org };

    case "NEXT": {
      const next = clampStep(state.step + 1);
      return {
        ...state,
        step: next,
        furthestStepReached: Math.max(state.furthestStepReached, next) as OnboardingStep,
      };
    }

    case "SKIP": {
      const next = clampStep(state.step + 1);
      return {
        ...state,
        step: next,
        furthestStepReached: Math.max(state.furthestStepReached, next) as OnboardingStep,
      };
    }

    case "BACK":
      return { ...state, step: clampStep(state.step - 1) };

    case "JUMP_TO":
      if (action.step > state.furthestStepReached) return state;
      return { ...state, step: action.step };

    default:
      return state;
  }
}
