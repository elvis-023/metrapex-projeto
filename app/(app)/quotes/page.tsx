import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  QuoteListFilters,
  ALL_SALESPEOPLE,
  ALL_STATUSES,
} from "@/components/quotes/quote-list-filters";
import { QuoteTable } from "@/components/quotes/quote-table";
import { initialsOf, type Salesperson } from "@/lib/pipeline/mock-data";
import { getQuotes, type QuoteListEntry } from "@/lib/quotes/queries";

export const metadata: Metadata = { title: "Orçamentos" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    ownerId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const {
    q = "",
    status = ALL_STATUSES,
    ownerId = ALL_SALESPEOPLE,
    from = "",
    to = "",
  } = await searchParams;

  const allQuotes = await getQuotes();

  // Revisões antigas ficam de fora da lista — mesma regra do board do
  // Pipeline: só a versão atual de cada orçamento é um registro "vivo"; o
  // histórico continua acessível pela página de detalhe.
  const currentRevisions = allQuotes.filter((quote) => !quote.supersededByRevisionId);

  // As opções de vendedor saem dos próprios orçamentos, não de uma lista de
  // perfis à parte — só aparece quem tem orçamento, mesma regra do Pipeline.
  const salespeople = collectSalespeople(currentRevisions);

  const normalizedQuery = q.trim().toLowerCase();
  const quotes = currentRevisions.filter((quote) => {
    if (normalizedQuery) {
      const matchesNumber = quote.number.toLowerCase().includes(normalizedQuery);
      const matchesCustomer = quote.customerName.toLowerCase().includes(normalizedQuery);
      if (!matchesNumber && !matchesCustomer) return false;
    }
    if (status !== ALL_STATUSES && quote.status !== status) return false;
    if (ownerId !== ALL_SALESPEOPLE && quote.ownerId !== ownerId) return false;
    if (from || to) {
      const createdDateKey = toLocalDateKey(quote.createdAt);
      if (from && createdDateKey < from) return false;
      if (to && createdDateKey > to) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <QuoteListFilters
          q={q}
          status={status}
          ownerId={ownerId}
          dateFrom={from}
          dateTo={to}
          salespeople={salespeople}
        />
        <Button
          size="sm"
          render={
            <Link href="/quotes/new">
              <PlusIcon />
              Novo orçamento
            </Link>
          }
          nativeButton={false}
        />
      </div>

      <QuoteTable quotes={quotes} hasAnyQuotes={currentRevisions.length > 0} />
    </div>
  );
}

function collectSalespeople(quotes: QuoteListEntry[]): Salesperson[] {
  const byId = new Map<string, Salesperson>();
  for (const quote of quotes) {
    if (!quote.ownerId || byId.has(quote.ownerId)) continue;
    const name = quote.ownerName ?? "Não atribuído";
    byId.set(quote.ownerId, { id: quote.ownerId, name, initials: initialsOf(name) });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Mesma conversão do filtro de período do board do Pipeline — compara por dia civil local, não UTC. */
function toLocalDateKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
