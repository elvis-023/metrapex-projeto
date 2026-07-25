import type { Metadata } from "next";

import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { getCategories, getProducts } from "@/lib/catalog/mock-data";
import { getCustomers, getCustomerSources } from "@/lib/customers/mock-data";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage() {
  const [products, categories, customers, sources] = await Promise.all([
    getProducts(),
    getCategories(),
    getCustomers(),
    getCustomerSources(),
  ]);

  return (
    <QuoteBuilder
      revision={1}
      products={products}
      categories={categories}
      customers={customers}
      sources={sources}
    />
  );
}
