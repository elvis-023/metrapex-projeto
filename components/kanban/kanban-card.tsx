"use client";

import Link from "next/link";
import type { DragEvent } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CustomerSourceBadge } from "@/components/customers/customer-source-badge";
import { cn } from "@/lib/utils";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";
import { resolveAssignee, type PipelineQuote } from "@/lib/pipeline/mock-data";
import { stageHoverClass } from "@/lib/pipeline/stage-colors";

// Exportadas só para o teste (kanban-card.test.ts) — `quotes.expires_at` é
// nullable (Milestone 14) e já quebrou a página inteira do pipeline uma vez
// (RangeError: Invalid time value ao formatar data nula); cobrir o caso
// `null` aqui evita a regressão voltar despercebida.
export function expiryTone(expiresAt: string | null, status: PipelineQuote["status"]): string {
  if (status === "expirado") return "text-danger";
  if (status === "convertido" || !expiresAt) return "text-muted-foreground";
  const daysLeft = Math.ceil((parseDateOnly(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (daysLeft <= 2) return "text-warning";
  return "text-muted-foreground";
}

/** `quotes.expires_at` é opcional (Milestone 14) — sem validade definida, o card mostra um rótulo fixo em vez de tentar formatar uma data que não existe. */
export function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "Sem prazo";
  return dateFormatter.format(parseDateOnly(expiresAt));
}

export function KanbanCard({
  quote,
  onDragStart,
}: {
  quote: PipelineQuote;
  onDragStart: (event: DragEvent<HTMLAnchorElement>, quoteId: string) => void;
}) {
  const assignee = resolveAssignee(quote);

  return (
    <Link
      href={`/pipeline/${quote.id}`}
      draggable
      onDragStart={(event) => onDragStart(event, quote.id)}
      className="block cursor-grab active:cursor-grabbing"
    >
      <Card
        size="sm"
        className={cn(
          "gap-2.5 border border-transparent transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5",
          stageHoverClass[quote.status],
        )}
      >
        <div className="flex items-center justify-between px-3">
          <span className="font-mono text-xs font-medium tabular-nums">{quote.number}</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {currencyFormatter.format(quote.total)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 px-3">
          <span className="truncate text-sm font-medium">{quote.customerName}</span>
          <CustomerSourceBadge sourceId={quote.sourceId} />
        </div>
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-1.5">
            <Avatar size="sm">
              <AvatarFallback>{assignee.initials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">{assignee.name}</span>
          </div>
          <span className={cn("text-xs tabular-nums", expiryTone(quote.expiresAt, quote.status))}>
            {expiryLabel(quote.expiresAt)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
