import { defaultFooterTextByTemplate } from "@/lib/onboarding/mock-data";
import type {
  CatalogPreviewRow,
  OnboardingState,
  OnboardingStep,
  TaxTemplateId,
} from "@/lib/onboarding/types";

export type OnboardingAction =
  | { type: "HYDRATE"; state: OnboardingState }
  | { type: "SET_ORGANIZATION"; field: keyof OnboardingState["organization"]; value: string }
  | { type: "SET_TAX_TEMPLATE"; templateId: TaxTemplateId }
  | { type: "SET_TAX_FIELD"; field: "icmsRate" | "ipiCategoryRate" | "footerText"; value: string }
  | { type: "SET_CATALOG_MODE"; mode: OnboardingState["catalog"]["mode"] }
  | { type: "UPLOAD_CATALOG_FILE"; fileName: string; rows: CatalogPreviewRow[] }
  | { type: "CLEAR_CATALOG_FILE" }
  | { type: "SET_MANUAL_PRODUCT"; field: "manualProductName" | "manualProductPrice"; value: string }
  | { type: "ADD_MANUAL_PRODUCT" }
  | { type: "REMOVE_CATALOG_ROW"; row: number }
  | { type: "SET_PAYMENT_CONDITION"; conditionId: string }
  | { type: "SET_PAYMENT_NOTE"; value: string }
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
      return state.taxTemplate.templateId !== undefined;
    case 3:
      return true;
    case 4:
      return state.payment.conditionId !== "";
    case 5:
      return true;
    default:
      return true;
  }
}

function clampStep(step: number): OnboardingStep {
  return Math.min(5, Math.max(1, step)) as OnboardingStep;
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "SET_ORGANIZATION":
      return {
        ...state,
        organization: { ...state.organization, [action.field]: action.value },
      };

    case "SET_TAX_TEMPLATE":
      return {
        ...state,
        taxTemplate: {
          ...state.taxTemplate,
          templateId: action.templateId,
          footerText: defaultFooterTextByTemplate[action.templateId],
        },
      };

    case "SET_TAX_FIELD":
      return {
        ...state,
        taxTemplate: { ...state.taxTemplate, [action.field]: action.value },
      };

    case "SET_CATALOG_MODE":
      return { ...state, catalog: { ...state.catalog, mode: action.mode } };

    case "UPLOAD_CATALOG_FILE":
      return {
        ...state,
        catalog: { ...state.catalog, fileName: action.fileName, rows: action.rows },
      };

    case "CLEAR_CATALOG_FILE":
      return { ...state, catalog: { ...state.catalog, fileName: null, rows: [] } };

    case "SET_MANUAL_PRODUCT":
      return {
        ...state,
        catalog: { ...state.catalog, [action.field]: action.value },
      };

    case "ADD_MANUAL_PRODUCT": {
      const name = state.catalog.manualProductName.trim();
      const price = state.catalog.manualProductPrice.trim();
      if (!name || !price) return state;

      const nextRow: CatalogPreviewRow = {
        row: state.catalog.rows.length + 2,
        code: `MAN-${String(state.catalog.rows.length + 1).padStart(3, "0")}`,
        name,
        price,
        status: "ok",
      };

      return {
        ...state,
        catalog: {
          ...state.catalog,
          rows: [...state.catalog.rows, nextRow],
          manualProductName: "",
          manualProductPrice: "",
        },
      };
    }

    case "REMOVE_CATALOG_ROW":
      return {
        ...state,
        catalog: {
          ...state.catalog,
          rows: state.catalog.rows.filter((row) => row.row !== action.row),
        },
      };

    case "SET_PAYMENT_CONDITION":
      return { ...state, payment: { ...state.payment, conditionId: action.conditionId } };

    case "SET_PAYMENT_NOTE":
      return { ...state, payment: { ...state.payment, note: action.value } };

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
