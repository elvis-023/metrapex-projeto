import Link from "next/link";
import { ArrowLeftIcon, GitBranchPlusIcon, HistoryIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddQuoteNoteForm } from "@/components/kanban/add-quote-note-form";
import { LiveQuoteStatus } from "@/components/kanban/live-quote-status";
import { QuoteTimeline } from "@/components/kanban/quote-timeline";
import { CustomerSourceBadge } from "@/components/customers/customer-source-badge";
import { IssueQuoteButton } from "@/components/quotes/issue-quote-button";
import { QuotePdfPreview } from "@/components/quotes/quote-pdf-preview";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";
import { initialsOf, type PipelineActivity } from "@/lib/pipeline/mock-data";
import type { QuoteDocument } from "@/lib/quotes/types";

/**
 * Server Component: o documento vem do banco (Milestone 14) e a timeline vem
 * de `quote_activities` (Milestone 16) — nada aqui é mockado. Quando emitido,
 * cada número do documento é o snapshot congelado — nenhuma linha desta tela
 * consulta `tax_types`, `tax_rates` ou `payment_conditions` (briefing §3,
 * skill `snapshot-documento`).
 */
export function QuoteDetail({
  quote,
  ownerName,
  activities,
  canEdit,
}: {
  quote: QuoteDocument;
  ownerName: string | null;
  activities: PipelineActivity[];
  canEdit: boolean;
}) {
  const isSuperseded = Boolean(quote.supersededByRevisionId);
  const isIssued = Boolean(quote.issuedAt);

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
        <div className="flex items-center gap-2">
          {!isIssued && !isSuperseded ? <IssueQuoteButton quoteId={quote.id} /> : null}
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

      {!isIssued ? (
        <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-sm">
          Rascunho — preço e imposto são recalculados com a configuração atual a cada abertura. A
          emissão congela os valores no documento.
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
              {quote.customerSourceId ? (
                <CustomerSourceBadge sourceId={quote.customerSourceId} />
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Total</span>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {currencyFormatter.format(quote.view.total)}
              </span>
            </div>
            {quote.expiresAt ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Validade</span>
                <span className="text-sm tabular-nums">
                  {dateFormatter.format(parseDateOnly(quote.expiresAt))}
                </span>
              </div>
            ) : null}
            {quote.paymentConditionLabel || quote.paymentBandLabel ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Condição de pagamento</span>
                <span className="text-sm">{quote.paymentConditionLabel ?? "—"}</span>
                {quote.paymentBandLabel ? (
                  <span className="text-muted-foreground text-xs">
                    Faixa: {quote.paymentBandLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            {ownerName ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Responsável</span>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initialsOf(ownerName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{ownerName}</span>
                </div>
              </div>
            ) : null}
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

        <div className="lg:col-span-2">
          <QuotePdfPreview
            number={quote.number}
            revision={quote.revision}
            customerName={quote.customerName}
            customerDocument={quote.customerDocument || null}
            view={quote.view}
            discount={quote.discount}
            paymentConditionLabel={quote.paymentConditionLabel}
            footerNote={quote.taxFooterNote}
            showTaxLines={quote.showTaxLines}
            issued={isIssued}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline de atividades</CardTitle>
          <CardDescription>Histórico do orçamento desde a geração</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <QuoteTimeline activities={activities} />
          {canEdit ? <AddQuoteNoteForm quoteId={quote.id} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
