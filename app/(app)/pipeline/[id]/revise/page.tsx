import type { Metadata } from "next";

import { ReviseQuoteView } from "@/components/quotes/revise-quote-view";
import { getCategories, getProducts } from "@/lib/catalog/mock-data";
import { getCustomerSources } from "@/lib/customers/mock-data";

export const metadata: Metadata = { title: "Nova revisão" };

export default async function ReviseQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [products, categories, sources] = await Promise.all([
    getProducts(),
    getCategories(),
    getCustomerSources(),
  ]);

  return (
    <ReviseQuoteView quoteId={id} products={products} categories={categories} sources={sources} />
  );
}
