"use client";

import Link from "next/link";
import type { DragEvent } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CustomerSourceBadge } from "@/components/customers/customer-source-badge";
import { cn } from "@/lib/utils";
import { currencyFormatter, dateFormatter, parseDateOnly } from "@/lib/dashboard/format";
import { resolveAssignee, type PipelineQuote } from "@/lib/pipeline/mock-data";

function expiryTone(expiresAt: string, status: PipelineQuote["status"]): string {
  if (status === "expirado") return "text-danger";
  if (status === "convertido") return "text-muted-foreground";
  const daysLeft = Math.ceil((parseDateOnly(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (daysLeft <= 2) return "text-warning";
  return "text-muted-foreground";
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
      <Card size="sm" className="hover:ring-foreground/20 gap-2.5 transition-shadow">
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
            {dateFormatter.format(parseDateOnly(quote.expiresAt))}
          </span>
        </div>
      </Card>
    </Link>
  );
}
