import { detectDocumentType, isValidCnpj, isValidCpf } from "@/lib/public-form/cpf-cnpj";
import type { PublicFormAddress, PublicFormState, PublicFormStep } from "@/lib/public-form/types";
import { emptyAddress } from "@/lib/public-form/types";

export function initialPublicFormState(preloadedProductId: string | null): PublicFormState {
  return {
    step: 1,
    submitted: false,
    protocolNumber: null,
    document: "",
    legalName: "",
    contactName: "",
    email: "",
    phone: "",
    address: emptyAddress,
    documentLookupStatus: "idle",
    cepLookupStatus: "idle",
    cart: preloadedProductId ? [{ productId: preloadedProductId, quantity: 1 }] : [],
    honeypot: "",
    captchaToken: null,
    submitting: false,
    submitError: null,
  };
}

export type PublicFormAction =
  | { type: "SET_DOCUMENT"; digits: string }
  | { type: "LOOKUP_DOCUMENT_START" }
  | { type: "LOOKUP_DOCUMENT_SUCCESS"; legalName: string; address: PublicFormAddress }
  | { type: "LOOKUP_DOCUMENT_ERROR" }
  | { type: "SET_CEP"; digits: string }
  | { type: "LOOKUP_CEP_START" }
  | { type: "LOOKUP_CEP_SUCCESS"; address: PublicFormAddress }
  | { type: "LOOKUP_CEP_ERROR" }
  | { type: "SET_FIELD"; field: "legalName" | "contactName" | "email" | "phone"; value: string }
  | { type: "SET_ADDRESS_FIELD"; field: keyof PublicFormAddress; value: string }
  | { type: "ADD_PRODUCT"; productId: string }
  | { type: "REMOVE_PRODUCT"; productId: string }
  | { type: "SET_QUANTITY"; productId: string; quantity: number }
  | { type: "SET_HONEYPOT"; value: string }
  | { type: "CAPTCHA_VERIFIED"; token: string }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; protocolNumber: string }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "RESET"; preloadedProductId: string | null };

export function isStepValid(state: PublicFormState, step: PublicFormStep): boolean {
  const emailValid = /\S+@\S+\.\S+/.test(state.email.trim());
  const phoneValid = state.phone.trim().length >= 10;

  switch (step) {
    case 1: {
      const commonValid =
        emailValid &&
        phoneValid &&
        state.address.street.trim().length > 0 &&
        state.address.city.trim().length > 0;

      // CNPJ exige também o nome do responsável; CPF não tem esse campo.
      // Documento incompleto (tipo indeterminado) nunca é válido.
      const documentType = detectDocumentType(state.document);
      if (documentType === "cnpj") {
        return (
          isValidCnpj(state.document) &&
          state.legalName.trim().length > 1 &&
          state.contactName.trim().length > 1 &&
          commonValid
        );
      }
      if (documentType === "cpf") {
        return isValidCpf(state.document) && state.legalName.trim().length > 1 && commonValid;
      }
      return false;
    }
    case 2:
      return state.cart.length > 0 && state.honeypot === "" && state.captchaToken !== null;
    default:
      return true;
  }
}

function clampStep(step: number): PublicFormStep {
  return Math.min(2, Math.max(1, step)) as PublicFormStep;
}

export function publicFormReducer(
  state: PublicFormState,
  action: PublicFormAction,
): PublicFormState {
  switch (action.type) {
    case "SET_DOCUMENT": {
      /**
       * Se a consulta anterior tinha preenchido razão social e endereço
       * sozinha, mudar o documento invalida esses dados — eles descrevem
       * outra empresa. Sem isto, apagar um CNPJ consultado e digitar outro
       * (ou um CPF) deixaria a razão social antiga no formulário.
       * `documentLookupStatus` volta a "idle" no mesmo instante, então isto
       * dispara só na PRIMEIRA tecla depois de um preenchimento automático.
       */
      const clearAutofilled = state.documentLookupStatus === "done";
      return {
        ...state,
        document: action.digits,
        documentLookupStatus: "idle",
        ...(clearAutofilled ? { legalName: "", address: emptyAddress } : {}),
      };
    }

    case "LOOKUP_DOCUMENT_START":
      return { ...state, documentLookupStatus: "loading" };

    case "LOOKUP_DOCUMENT_SUCCESS":
      return {
        ...state,
        documentLookupStatus: "done",
        legalName: action.legalName,
        address: action.address,
      };

    case "LOOKUP_DOCUMENT_ERROR":
      return { ...state, documentLookupStatus: "error" };

    case "SET_CEP":
      return {
        ...state,
        address: { ...state.address, zip: action.digits },
        cepLookupStatus: "idle",
      };

    case "LOOKUP_CEP_START":
      return { ...state, cepLookupStatus: "loading" };

    case "LOOKUP_CEP_SUCCESS":
      return { ...state, cepLookupStatus: "done", address: action.address };

    case "LOOKUP_CEP_ERROR":
      return { ...state, cepLookupStatus: "error" };

    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "SET_ADDRESS_FIELD":
      return { ...state, address: { ...state.address, [action.field]: action.value } };

    case "ADD_PRODUCT": {
      const existing = state.cart.find((item) => item.productId === action.productId);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((item) =>
            item.productId === action.productId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }
      return { ...state, cart: [...state.cart, { productId: action.productId, quantity: 1 }] };
    }

    case "REMOVE_PRODUCT":
      return { ...state, cart: state.cart.filter((item) => item.productId !== action.productId) };

    case "SET_QUANTITY":
      if (action.quantity <= 0) {
        return { ...state, cart: state.cart.filter((item) => item.productId !== action.productId) };
      }
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.productId === action.productId ? { ...item, quantity: action.quantity } : item,
        ),
      };

    case "SET_HONEYPOT":
      return { ...state, honeypot: action.value };

    case "CAPTCHA_VERIFIED":
      return { ...state, captchaToken: action.token };

    case "NEXT":
      return { ...state, step: clampStep(state.step + 1) };

    case "BACK":
      return { ...state, step: clampStep(state.step - 1) };

    case "SUBMIT_START":
      return { ...state, submitting: true, submitError: null };

    case "SUBMIT_SUCCESS":
      return {
        ...state,
        submitting: false,
        submitted: true,
        protocolNumber: action.protocolNumber,
      };

    case "SUBMIT_ERROR":
      return { ...state, submitting: false, submitError: action.message };

    case "RESET":
      return initialPublicFormState(action.preloadedProductId);

    default:
      return state;
  }
}
