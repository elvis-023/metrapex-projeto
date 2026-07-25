import type { CustomerSource } from "@/lib/customers/types";

/**
 * Origens fixas do produto por enquanto (Site e CRM) — a tela de
 * gerenciamento em `/customers` permite cadastrar outras, mesmo sem
 * persistência real ainda (Fase 1, dados mockados).
 */
export const fakeCustomerSources: CustomerSource[] = [
  { id: "site", name: "Site" },
  { id: "crm", name: "CRM" },
];

const customerSourceById = new Map(fakeCustomerSources.map((source) => [source.id, source]));

export function getCustomerSource(sourceId: string): CustomerSource {
  return customerSourceById.get(sourceId) ?? fakeCustomerSources[0];
}

export async function getCustomerSources(): Promise<CustomerSource[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return fakeCustomerSources;
}
