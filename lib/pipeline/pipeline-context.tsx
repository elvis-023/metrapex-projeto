"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { FakeQuoteStatus } from "@/lib/mock-data";
import type { PipelineQuote } from "@/lib/pipeline/mock-data";

type PipelineContextValue = {
  quotes: PipelineQuote[];
  moveQuote: (quoteId: string, status: FakeQuoteStatus) => void;
};

const PipelineContext = createContext<PipelineContextValue | null>(null);

/**
 * Vive no layout do painel autenticado inteiro (`app/(app)/layout.tsx`) porque
 * `/pipeline/[id]` e o board leem a etapa arrastada na sessão.
 *
 * A criação de orçamento NÃO passa mais por aqui: desde a Milestone 14 ela
 * grava no banco e o servidor revalida `/pipeline`. O único estado local que
 * resta é a etapa movida por arrastar-e-soltar, guardada como sobreposição
 * sobre os dados do servidor — assim um orçamento novo aparece no board na
 * revalidação, sem depender de reset de `useState`. A persistência da etapa é
 * Milestone 16.
 */
export function PipelineProvider({
  initialQuotes,
  children,
}: {
  initialQuotes: PipelineQuote[];
  children: ReactNode;
}) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, FakeQuoteStatus>>({});

  const quotes = useMemo(
    () =>
      initialQuotes.map((quote) =>
        statusOverrides[quote.id] ? { ...quote, status: statusOverrides[quote.id] } : quote,
      ),
    [initialQuotes, statusOverrides],
  );

  function moveQuote(quoteId: string, status: FakeQuoteStatus) {
    setStatusOverrides((current) => ({ ...current, [quoteId]: status }));
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
