import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LiveQuoteStatus } from "@/components/kanban/live-quote-status";
import { QuoteTimeline } from "@/components/kanban/quote-timeline";
import { CustomerSourceBadge } from "@/components/customers/customer-source-badge";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";
import { getPipelineQuoteById, getQuoteActivities, getSalesperson } from "@/lib/pipeline/mock-data";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getPipelineQuoteById(id);

  if (!quote) {
    notFound();
  }

  const [activities, assignee] = await Promise.all([
    getQuoteActivities(quote),
    Promise.resolve(getSalesperson(quote.assigneeId)),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link href="/pipeline">
            <ArrowLeftIcon />
            Voltar ao pipeline
          </Link>
        }
        nativeButton={false}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono tabular-nums">{quote.number}</CardTitle>
              <LiveQuoteStatus quoteId={quote.id} fallbackStatus={quote.status} />
            </div>
            <CardDescription className="flex items-center gap-1.5">
              <span>{quote.customerName}</span>
              <CustomerSourceBadge sourceId={quote.sourceId} />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Total</span>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {currencyFormatter.format(quote.total)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Validade</span>
              <span className="text-sm tabular-nums">
                {dateFormatter.format(parseDateOnly(quote.expiresAt))}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Responsável</span>
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>{assignee.initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{assignee.name}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Timeline de atividades</CardTitle>
            <CardDescription>Histórico do orçamento desde a geração</CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
