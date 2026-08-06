import type { PublicFormAddress } from "@/lib/public-form/types";

export type CustomerSource = {
  id: string;
  name: string;
};

export type CustomerAddress = PublicFormAddress;

/** Consumidor final não revende; revenda compra para revender. */
export type CustomerTaxClassification = "consumidor_final" | "revenda";

/** Uma pessoa associada ao cliente — quem pediu o orçamento, quem compra, o financeiro. */
export type CustomerContact = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
};

/** Cliente (empresa ou pessoa) identificado por CPF/CNPJ, único por organização. */
export type Customer = {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  address: CustomerAddress | null;
  taxClassification: CustomerTaxClassification;
  icmsContribuinte: boolean;
  /** `null` = detecção ainda não rodou (ou não se aplica, ex.: CPF) — nunca confundir com `false`. */
  simplesNacionalOptante: boolean | null;
};

export type CustomerWithContacts = Customer & { contacts: CustomerContact[] };
