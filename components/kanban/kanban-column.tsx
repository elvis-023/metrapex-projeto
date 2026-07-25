"use client";

import type { DragEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { stageAccentClass } from "@/lib/pipeline/stage-colors";
import type { PipelineQuote, PipelineStage } from "@/lib/pipeline/mock-data";

export function KanbanColumn({
  stage,
  quotes,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  stage: PipelineStage;
  quotes: PipelineQuote[];
  isDropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLAnchorElement>, quoteId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, status: PipelineStage["status"]) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, status: PipelineStage["status"]) => void;
}) {
  return (
    <div
      onDragOver={(event) => onDragOver(event, stage.status)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, stage.status)}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-transparent p-2.5 transition-colors",
        isDropTarget && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", stageAccentClass[stage.status])} />
          <span className="text-sm font-medium">{stage.label}</span>
        </div>
        <Badge variant="outline">{quotes.length}</Badge>
      </div>

      <div className="flex min-h-24 flex-col gap-2">
        {quotes.length === 0 ? (
          <EmptyState title="Sem orçamentos" className="border-none px-2 py-8 text-xs" />
        ) : (
          quotes.map((quote) => (
            <KanbanCard key={quote.id} quote={quote} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  );
}
