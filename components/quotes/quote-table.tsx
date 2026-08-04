import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { CustomerSourceBadge } from "@/components/customers/customer-source-badge";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";
import type { QuoteListEntry } from "@/lib/quotes/queries";

function createdAtLabel(createdAt: string): string {
  const date = new Date(createdAt);
  return dateFormatter.format(date);
}

export function QuoteTable({
  quotes,
  hasAnyQuotes,
}: {
  quotes: QuoteListEntry[];
  hasAnyQuotes: boolean;
}) {
  if (quotes.length === 0) {
    return hasAnyQuotes ? (
      <EmptyState
        title="Nenhum orçamento encontrado"
        description="Ajuste a busca ou os filtros de status, vendedor e período."
      />
    ) : (
      <EmptyState
        title="Nenhum orçamento ainda"
        description="Crie o primeiro orçamento manualmente ou aguarde o primeiro pedido pelo formulário público."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orçamento</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Criado em</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotes.map((quote) => (
          <TableRow key={quote.id} className="cursor-pointer">
            <TableCell className="font-medium">
              <Link href={`/pipeline/${quote.id}`} className="hover:underline">
                {quote.number}
              </Link>
            </TableCell>
            <TableCell className="max-w-48">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{quote.customerName}</span>
                {quote.customerSourceId && (
                  <CustomerSourceBadge sourceId={quote.customerSourceId} />
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {quote.ownerName ?? "Não atribuído"}
            </TableCell>
            <TableCell>
              <QuoteStatusBadge status={quote.status} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {createdAtLabel(quote.createdAt)}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {quote.expiresAt ? dateFormatter.format(parseDateOnly(quote.expiresAt)) : "Sem prazo"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {currencyFormatter.format(quote.total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
