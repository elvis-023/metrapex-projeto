export type PublicFormStep = 1 | 2;

export type DocumentType = "cpf" | "cnpj";

export type LookupStatus = "idle" | "loading" | "done" | "error";

export type PublicFormAddress = {
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type PublicFormCartItem = {
  productId: string;
  quantity: number;
};

export type PublicOrganization = {
  slug: string;
  name: string;
  logoInitial: string;
  supportEmail: string;
};

export type PublicFormState = {
  step: PublicFormStep;
  submitted: boolean;
  protocolNumber: string | null;
  /**
   * Só os dígitos. Se é CPF ou CNPJ é DERIVADO daqui via
   * `detectDocumentType` — não existe seletor manual nem campo de tipo no
   * estado, para não haver duas fontes de verdade que possam divergir.
   */
  document: string;
  legalName: string;
  contactName: string;
  email: string;
  phone: string;
  address: PublicFormAddress;
  documentLookupStatus: LookupStatus;
  cepLookupStatus: LookupStatus;
  cart: PublicFormCartItem[];
  honeypot: string;
  captchaToken: string | null;
  submitting: boolean;
  submitError: string | null;
};

export const emptyAddress: PublicFormAddress = {
  zip: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};
