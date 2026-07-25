"use client";

import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import type { FakeQuoteStatus } from "@/lib/mock-data";
import { usePipelineQuotes } from "@/lib/pipeline/pipeline-context";

/**
 * Reflete a etapa atual do orçamento no board (após drag-and-drop
 * local) em vez do status congelado no momento em que a página de
 * detalhe foi carregada — os dois compartilham o mesmo `PipelineProvider`
 * no layout de `/pipeline`.
 */
export function LiveQuoteStatus({
  quoteId,
  fallbackStatus,
}: {
  quoteId: string;
  fallbackStatus: FakeQuoteStatus;
}) {
  const { quotes } = usePipelineQuotes();
  const status = quotes.find((quote) => quote.id === quoteId)?.status ?? fallbackStatus;

  return <QuoteStatusBadge status={status} />;
}
