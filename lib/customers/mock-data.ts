import type { Customer, CustomerSource } from "@/lib/customers/types";

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

/** Mesmos clientes que aparecem nos orçamentos de `lib/pipeline/mock-data.ts`, com dados de cadastro completos para a busca do construtor de orçamento. */
export const fakeCustomers: Customer[] = [
  {
    id: "cus_1",
    name: "Padaria Bom Pão",
    document: "12.345.678/0001-90",
    email: "contato@padariabompao.com.br",
    phone: "(11) 91234-5678",
    sourceId: "site",
  },
  {
    id: "cus_2",
    name: "Auto Peças Nova Era",
    document: "23.456.789/0001-01",
    email: "compras@novaera.com.br",
    phone: "(11) 92345-6789",
    sourceId: "crm",
  },
  {
    id: "cus_3",
    name: "Studio Fotográfico Luz",
    document: "345.678.901-22",
    email: "contato@studioluz.com.br",
    phone: "(11) 93456-7890",
    sourceId: "site",
  },
  {
    id: "cus_4",
    name: "Mercado Central",
    document: "45.678.901/0001-33",
    email: "compras@mercadocentral.com.br",
    phone: "(11) 94567-8901",
    sourceId: "crm",
  },
  {
    id: "cus_5",
    name: "Oficina do Zé",
    document: "567.890.123-44",
    email: "oficina.ze@gmail.com",
    phone: "(11) 95678-9012",
    sourceId: "site",
  },
  {
    id: "cus_6",
    name: "Farmácia Vitalis",
    document: "67.890.123/0001-55",
    email: "compras@farmaciavitalis.com.br",
    phone: "(11) 96789-0123",
    sourceId: "site",
  },
];

const customerById = new Map(fakeCustomers.map((customer) => [customer.id, customer]));

export function getCustomer(customerId: string): Customer | undefined {
  return customerById.get(customerId);
}

export async function getCustomers(): Promise<Customer[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return fakeCustomers;
}
