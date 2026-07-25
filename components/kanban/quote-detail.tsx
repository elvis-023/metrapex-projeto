"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, GitBranchPlusIcon, HistoryIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LiveQuoteStatus } from "@/components/kanban/live-quote-status";
import { QuoteTimeline } from "@/components/kanban/quote-timeline";
import { CustomerSourceBadge } from "@/components/customers/customer-source-badge";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";
import { getQuoteActivitiesSync, getSalesperson } from "@/lib/pipeline/mock-data";
import { usePipelineQuotes } from "@/lib/pipeline/pipeline-context";

/**
 * Client Component — o orçamento pode ter sido criado ou revisado nesta
 * mesma sessão (estado local do `PipelineProvider`, sem persistência
 * real ainda), então a busca precisa ler do contexto ao vivo em vez de
 * um fetch de servidor sobre o array mockado estático (que não sabe de
 * nada criado depois do primeiro load).
 */
export function QuoteDetail({ id }: { id: string }) {
  const { quotes } = usePipelineQuotes();
  const quote = quotes.find((q) => q.id === id);

  if (!quote) {
    notFound();
  }

  const activities = getQuoteActivitiesSync(quote);
  const assignee = getSalesperson(quote.assigneeId);
  const isSuperseded = Boolean(quote.supersededByRevisionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
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
        {isSuperseded ? (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/pipeline/${quote.supersededByRevisionId}`}>Ver revisão atual</Link>
            }
            nativeButton={false}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/pipeline/${quote.id}/revise`}>
                <GitBranchPlusIcon />
                Nova revisão
              </Link>
            }
            nativeButton={false}
          />
        )}
      </div>

      {isSuperseded ? (
        <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-sm">
          Versão antiga — a revisão {quote.revision} de {quote.number} foi substituída por uma mais
          recente.{" "}
          <Link
            href={`/pipeline/${quote.supersededByRevisionId}`}
            className="font-medium underline"
          >
            Ver a revisão atual
          </Link>
          .
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CardTitle className="font-mono tabular-nums">{quote.number}</CardTitle>
                {quote.revision > 1 ? (
                  <Badge variant="outline">revisão {quote.revision}</Badge>
                ) : null}
                {isSuperseded ? <Badge variant="secondary">Versão antiga</Badge> : null}
              </div>
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
            {quote.previousRevisionId ? (
              <Link
                href={`/pipeline/${quote.previousRevisionId}`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
              >
                <HistoryIcon className="size-3.5" />
                Ver revisão anterior
              </Link>
            ) : null}
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
