import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { EmptyState } from "@/components/states/empty-state";
import { getCategories } from "@/lib/catalog/queries";
import { getCustomers, getCustomerSources } from "@/lib/customers/mock-data";
import { getQuoteBuilderData } from "@/lib/quotes/queries";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage() {
  // Cliente ainda é mock (Milestone 17) — o orçamento guarda nome e documento
  // copiados, então o vínculo real com `customers` entra sem migrar dado.
  const [data, categories, customers, sources] = await Promise.all([
    getQuoteBuilderData(),
    getCategories(),
    getCustomers(),
    getCustomerSources(),
  ]);

  if (!data) redirect("/login");

  if (data.products.length === 0) {
    return (
      <EmptyState
        title="Catálogo vazio"
        description="Cadastre ou importe produtos no catálogo antes de montar um orçamento."
      />
    );
  }

  return (
    <QuoteBuilder data={data} categories={categories} customers={customers} sources={sources} />
  );
}
