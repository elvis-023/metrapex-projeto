"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { FakeQuoteStatus } from "@/lib/mock-data";
import type { PipelineQuote } from "@/lib/pipeline/mock-data";

type PipelineContextValue = {
  quotes: PipelineQuote[];
  moveQuote: (quoteId: string, status: FakeQuoteStatus) => void;
  addQuote: (quote: PipelineQuote) => void;
  updateQuote: (quoteId: string, patch: Partial<PipelineQuote>) => void;
};

const PipelineContext = createContext<PipelineContextValue | null>(null);

/**
 * Vive no layout do painel autenticado inteiro (`app/(app)/layout.tsx`),
 * não só em `/pipeline` — a criação de orçamento em `/quotes/new`
 * também grava aqui, é o que garante que o card aparece no board sem
 * persistência real ainda (Milestone 16).
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

  function addQuote(quote: PipelineQuote) {
    setQuotes((current) => [quote, ...current]);
  }

  function updateQuote(quoteId: string, patch: Partial<PipelineQuote>) {
    setQuotes((current) =>
      current.map((quote) => (quote.id === quoteId ? { ...quote, ...patch } : quote)),
    );
  }

  return (
    <PipelineContext.Provider value={{ quotes, moveQuote, addQuote, updateQuote }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipelineQuotes(): PipelineContextValue {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipelineQuotes must be used within a PipelineProvider");
  }
  return context;
}
