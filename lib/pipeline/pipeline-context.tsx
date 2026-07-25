"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { FakeQuoteStatus } from "@/lib/mock-data";
import type { PipelineQuote } from "@/lib/pipeline/mock-data";

type PipelineContextValue = {
  quotes: PipelineQuote[];
  moveQuote: (quoteId: string, status: FakeQuoteStatus) => void;
};

const PipelineContext = createContext<PipelineContextValue | null>(null);

/**
 * Vive no layout do segmento `/pipeline`, que não remonta ao navegar
 * entre o board e a página de detalhe — é o que garante que o
 * drag-and-drop (estado local, sem persistência) sobrevive à ida e
 * volta para o detalhe do orçamento.
 */
export function PipelineProvider({
  initialQuotes,
  children,
}: {
  initialQuotes: PipelineQuote[];
  children: ReactNode;
}) {
  const [quotes, setQuotes] = useState(initialQuotes);

  function moveQuote(quoteId: string, status: FakeQuoteStatus) {
    setQuotes((current) =>
      current.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)),
    );
  }

  return (
    <PipelineContext.Provider value={{ quotes, moveQuote }}>{children}</PipelineContext.Provider>
  );
}

export function usePipelineQuotes(): PipelineContextValue {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipelineQuotes must be used within a PipelineProvider");
  }
  return context;
}
