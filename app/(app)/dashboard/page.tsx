import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { fakeRecentQuotes } from "@/lib/mock-data";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

const kpis = [
  { label: "Orçamentos no período", value: "24", hint: "+12% vs. período anterior" },
  {
    label: "Valor em pipeline",
    value: currencyFormatter.format(38940),
    hint: "9 orçamentos em aberto",
  },
  { label: "Taxa de conversão", value: "31%", hint: "+4pp vs. período anterior" },
  { label: "Tempo até o 1º orçamento", value: "4min 12s", hint: "do pedido do cliente ao PDF" },
];

async function getRecentQuotes() {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return fakeRecentQuotes;
}

export default async function DashboardPage() {
  const quotes = await getRecentQuotes();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orçamentos recentes</CardTitle>
          <CardDescription>Validade próxima do vencimento em destaque</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{quote.customerName}</TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {dateFormatter.format(new Date(quote.expiresAt))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currencyFormatter.format(quote.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
