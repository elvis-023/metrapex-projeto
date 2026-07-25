"use client";

import { useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";

import { QuoteBuilder } from "@/components/quotes/quote-builder";
import type { Product, ProductCategory } from "@/lib/catalog/types";
import { fakeCustomers } from "@/lib/customers/mock-data";
import type { Customer, CustomerSource } from "@/lib/customers/types";
import { usePipelineQuotes } from "@/lib/pipeline/pipeline-context";
import { seedRevisionItems } from "@/lib/quotes/mock-data";

/**
 * Client Component pelo mesmo motivo de `QuoteDetail`: o orçamento de
 * origem pode ter sido criado ou revisado nesta sessão, então a busca
 * lê do `PipelineProvider` ao vivo em vez de um fetch de servidor sobre
 * o array mockado estático.
 */
export function ReviseQuoteView({
  quoteId,
  products,
  categories,
  sources,
}: {
  quoteId: string;
  products: Product[];
  categories: ProductCategory[];
  sources: CustomerSource[];
}) {
  const router = useRouter();
  const { quotes } = usePipelineQuotes();
  const quote = quotes.find((q) => q.id === quoteId);

  // Congelado no primeiro render: se o próprio `QuoteBuilder` renderizado
  // abaixo superar ESTE orçamento (ao salvar a revisão que o usuário está
  // preenchendo agora), `quote.supersededByRevisionId` também passa a
  // existir — mas isso não deve redirecionar de volta para este formulário.
  // Só um link antigo, que já chega apontando para um orçamento já
  // substituído, deve disparar o redirecionamento.
  const [staleRedirectTarget] = useState(() => quote?.supersededByRevisionId ?? null);

  useEffect(() => {
    if (staleRedirectTarget) {
      router.replace(`/pipeline/${staleRedirectTarget}/revise`);
    }
  }, [staleRedirectTarget, router]);

  if (!quote) {
    notFound();
  }

  if (staleRedirectTarget) {
    return null;
  }

  const customer: Customer =
    fakeCustomers.find((c) => c.name === quote.customerName) ??
    ({
      id: `cus_pipeline_${quote.id}`,
      name: quote.customerName,
      document: "",
      email: "",
      phone: "",
      sourceId: quote.sourceId,
    } satisfies Customer);

  return (
    <QuoteBuilder
      number={quote.number}
      revision={quote.revision + 1}
      sourceQuoteId={quote.id}
      products={products}
      categories={categories}
      customers={fakeCustomers}
      sources={sources}
      initialCustomer={customer}
      initialItems={seedRevisionItems(quote.id)}
    />
  );
}
