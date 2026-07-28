"use server";

import { revalidatePath } from "next/cache";

import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeDocument } from "@/lib/public-form/cpf-cnpj";
import type { Customer, CustomerAddress, CustomerContact } from "@/lib/customers/types";

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
  };
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
