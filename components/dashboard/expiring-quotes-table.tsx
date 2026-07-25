import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { FakeQuote } from "@/lib/mock-data";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";

export function ExpiringQuotesTable({ quotes }: { quotes: FakeQuote[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vencendo em breve</CardTitle>
        <CardDescription>Orçamentos do vendedor logado com validade próxima</CardDescription>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <EmptyState
            title="Nenhum orçamento vencendo"
            description="Não há orçamentos com validade próxima no período selecionado."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orçamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.number}</TableCell>
                  <TableCell className="max-w-40">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{quote.customerName}</span>
                      <CustomerSourceBadge sourceId={quote.sourceId} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell className="text-warning tabular-nums">
                    {dateFormatter.format(parseDateOnly(quote.expiresAt))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currencyFormatter.format(quote.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
