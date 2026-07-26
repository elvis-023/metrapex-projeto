import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { QuoteBuilder, type QuoteBuilderItem } from "@/components/quotes/quote-builder";
import { getCategories } from "@/lib/catalog/queries";
import { getCustomers, getCustomerSources } from "@/lib/customers/mock-data";
import { getQuoteBuilderData, getQuoteById } from "@/lib/quotes/queries";
import type { Customer } from "@/lib/customers/types";

export const metadata: Metadata = { title: "Nova revisão" };

export default async function ReviseQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [quote, data, categories, customers, sources] = await Promise.all([
    getQuoteById(id),
    getQuoteBuilderData(),
    getCategories(),
    getCustomers(),
    getCustomerSources(),
  ]);

  if (!quote || !data) notFound();

  // Link antigo apontando para uma versão já substituída: leva para a revisão
  // atual, que é a única que pode receber uma revisão nova (o banco recusa
  // duas revisões da mesma versão — `quotes_uniq_previous_revision`).
  if (quote.supersededByRevisionId) {
    redirect(`/pipeline/${quote.supersededByRevisionId}/revise`);
  }

  /**
   * Os itens são herdados por PRODUTO e QUANTIDADE, não por valor: o motor
   * recalcula preço e alíquota com a configuração vigente (§11.4, decidido em
   * 2026-07-26). Produto que saiu do catálogo desde a versão anterior é
   * omitido, e o vendedor é avisado em vez de a tela quebrar no recálculo.
   */
  const catalogIds = new Set(data.products.map((product) => product.id));
  const initialItems: QuoteBuilderItem[] = [];
  const omittedProductNames: string[] = [];

  for (const item of quote.view.items) {
    if (item.productId && catalogIds.has(item.productId)) {
      initialItems.push({ productId: item.productId, quantity: item.quantity });
    } else {
      omittedProductNames.push(item.name);
    }
  }

  const customer: Customer = {
    id: quote.customerId ?? `cus_quote_${quote.id}`,
    name: quote.customerName,
    document: quote.customerDocument,
    email: "",
    phone: "",
    sourceId: quote.customerSourceId ?? "site",
  };

  return (
    <QuoteBuilder
      data={data}
      categories={categories}
      customers={customers}
      sources={sources}
      revisionOf={{ id: quote.id, number: quote.number, revision: quote.revision }}
      initialCustomer={customer}
      initialItems={initialItems}
      initialDiscount={quote.discount}
      omittedProductNames={omittedProductNames}
    />
  );
}
