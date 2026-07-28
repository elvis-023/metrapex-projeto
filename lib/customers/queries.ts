import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Customer, CustomerContact, CustomerWithContacts } from "@/lib/customers/types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerContactRow = Database["public"]["Tables"]["customer_contacts"]["Row"];

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address,
  };
}

function toContact(row: CustomerContactRow): CustomerContact {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
  };
}

/** Todos os clientes da organização — a busca por nome/CPF/CNPJ é filtrada em memória por quem consome (lista em `/customers`, busca do construtor de orçamento). */
export async function getCustomers(): Promise<Customer[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", org.id)
    .order("name");

  if (error || !data) return [];
  return data.map(toCustomer);
}

export async function getCustomerById(id: string): Promise<CustomerWithContacts | undefined> {
  const org = await getCurrentOrganization();
  if (!org) return undefined;

  const supabase = await createClient();
  const [{ data: customerRow, error: customerError }, { data: contactRows }] = await Promise.all([
    supabase.from("customers").select("*").eq("org_id", org.id).eq("id", id).maybeSingle(),
    supabase.from("customer_contacts").select("*").eq("customer_id", id).order("created_at"),
  ]);

  if (customerError || !customerRow) return undefined;

  return { ...toCustomer(customerRow), contacts: (contactRows ?? []).map(toContact) };
}
