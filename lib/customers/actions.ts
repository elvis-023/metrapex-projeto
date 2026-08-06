"use server";

import { revalidatePath } from "next/cache";

import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeDocument } from "@/lib/public-form/cpf-cnpj";
import { fetchCnpjData } from "@/lib/integrations/brasil-api";
import type {
  Customer,
  CustomerAddress,
  CustomerContact,
  CustomerTaxClassification,
} from "@/lib/customers/types";

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

/** Aceita com ou sem máscara — `normalizeDocument` (lib/public-form/cpf-cnpj.ts) só dígitos + dígito verificador. */
function normalizeAndValidateDocument(raw: string): string {
  const result = normalizeDocument(raw);
  if (!result.ok) throw new Error(result.error);
  return result.digits;
}

export type CustomerActionInput = {
  name: string;
  document: string;
  email: string;
  phone: string;
  address?: CustomerAddress | null;
  /** Omitido = mantém o default do banco (`consumidor_final`) — callers antigos (ex.: CustomerPicker) continuam funcionando sem alteração. */
  taxClassification?: CustomerTaxClassification;
  /** Omitido = mantém o default do banco (`false`) — manual, sem detecção automática. */
  icmsContribuinte?: boolean;
  /** Omitido/`undefined` = mantém o default do banco (`null`, "não detectado ainda"). */
  simplesNacionalOptante?: boolean | null;
};

/**
 * Cria ou atualiza por dedupe — cadastrar um documento que já existe na
 * organização não é erro, reaproveita e atualiza o registro (PLAN.md >
 * Milestone 17, "deduplicação automática dentro da organização").
 */
export async function upsertCustomerAction(input: CustomerActionInput): Promise<Customer> {
  const org = await requireOrg();
  if (!input.name.trim()) throw new Error("Nome/razão social obrigatório.");
  const document = normalizeAndValidateDocument(input.document);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_customer", {
    p_org_id: org.id,
    p_document: document,
    p_name: input.name.trim(),
    p_email: input.email.trim() || null,
    p_phone: input.phone.trim() || null,
    p_address: input.address ?? null,
    p_tax_classification: input.taxClassification ?? "consumidor_final",
    p_icms_contribuinte: input.icmsContribuinte ?? false,
    p_simples_nacional_optante: input.simplesNacionalOptante ?? null,
  });

  if (error || !data) throw new Error(error?.message ?? "Não foi possível salvar o cliente.");

  revalidatePath("/customers");
  return {
    id: data.id,
    name: data.name,
    document: data.document,
    email: data.email ?? "",
    phone: data.phone ?? "",
    address: data.address,
    taxClassification: data.tax_classification as CustomerTaxClassification,
    icmsContribuinte: data.icms_contribuinte,
    simplesNacionalOptante: data.simples_nacional_optante,
  };
}

export type CustomerCnpjLookupResult = {
  legalName: string;
  address: CustomerAddress;
  /** `null` = BrasilAPI não confirma opção pelo Simples (ou o dado não veio) — nunca `false` por omissão. */
  simplesNacionalOptante: boolean | null;
};

/**
 * Consulta a BrasilAPI para o CNPJ do cliente (razão social, endereço e
 * opção pelo Simples Nacional) — usada só pela tela autenticada de cadastro
 * de cliente (components/customers/customer-form.tsx). Não passa pela rota
 * pública `/api/public-quote/lookup-cnpj`: aquele contrato é deliberadamente
 * restrito a legalName+address para o visitante anônimo do formulário
 * público (decisão "Regime Tributário #4") e nunca deveria ganhar campos
 * fiscais. Mesmo padrão do onboarding (`detectTaxRegimeFromCnpjAction`,
 * lib/tax-engine/actions.ts): wrapper fino de Server Action sobre
 * `fetchCnpjData`, protegido por `requireOrg()` já que esta rota não tem o
 * rate-limit por IP que a pública tem.
 *
 * Só resolve o dado — nunca grava nada. O formulário decide se/quando
 * aplicar o resultado ao estado local, e só chega ao banco quando o
 * vendedor salva o cadastro (upsertCustomerAction), igual qualquer outro
 * campo do formulário.
 */
export async function lookupCustomerCnpjAction(
  cnpjDigits: string,
): Promise<CustomerCnpjLookupResult> {
  await requireOrg();
  const { legalName, address, opcaoPeloSimples } = await fetchCnpjData(cnpjDigits);
  return { legalName, address, simplesNacionalOptante: opcaoPeloSimples };
}

export async function deleteCustomerAction(id: string): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.from("customers").delete().eq("id", id).eq("org_id", org.id);
  if (error) throw new Error("Não foi possível excluir o cliente.");

  revalidatePath("/customers");
}

export type CustomerContactActionInput = {
  name: string;
  email: string;
  phone: string;
};

export async function upsertCustomerContactAction(
  customerId: string,
  input: CustomerContactActionInput,
): Promise<CustomerContact> {
  await requireOrg();
  if (!input.name.trim()) throw new Error("Nome do contato obrigatório.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_customer_contact", {
    p_customer_id: customerId,
    p_name: input.name.trim(),
    p_email: input.email.trim() || null,
    p_phone: input.phone.trim() || null,
  });

  if (error || !data) throw new Error(error?.message ?? "Não foi possível salvar o contato.");

  revalidatePath(`/customers/${customerId}`);
  return {
    id: data.id,
    customerId: data.customer_id,
    name: data.name,
    email: data.email ?? "",
    phone: data.phone ?? "",
  };
}

export async function deleteCustomerContactAction(
  contactId: string,
  customerId: string,
): Promise<void> {
  await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId);
  if (error) throw new Error("Não foi possível excluir o contato.");

  revalidatePath(`/customers/${customerId}`);
}
