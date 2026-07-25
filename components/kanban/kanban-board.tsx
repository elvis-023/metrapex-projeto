"use client";

import { useMemo, useState, type DragEvent } from "react";

import { KanbanColumn } from "@/components/kanban/kanban-column";
import { ALL_SALESPEOPLE, PipelineFilters } from "@/components/kanban/pipeline-filters";
import type { FakeQuoteStatus } from "@/lib/mock-data";
import { pipelineStages, type Salesperson } from "@/lib/pipeline/mock-data";
import { usePipelineQuotes } from "@/lib/pipeline/pipeline-context";

export function KanbanBoard({ salespeople }: { salespeople: Salesperson[] }) {
  const { quotes, moveQuote } = usePipelineQuotes();
  const [assigneeId, setAssigneeId] = useState(ALL_SALESPEOPLE);
  const [dropTarget, setDropTarget] = useState<FakeQuoteStatus | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const visibleQuotes = useMemo(
    () =>
      assigneeId === ALL_SALESPEOPLE
        ? quotes
        : quotes.filter((quote) => quote.assigneeId === assigneeId),
    [quotes, assigneeId],
  );

  function handleDragStart(event: DragEvent<HTMLAnchorElement>, quoteId: string) {
    event.dataTransfer.setData("text/plain", quoteId);
    event.dataTransfer.effectAllowed = "move";
    setDraggedId(quoteId);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, status: FakeQuoteStatus) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: FakeQuoteStatus) {
    event.preventDefault();
    const quoteId = event.dataTransfer.getData("text/plain") || draggedId;
    setDropTarget(null);
    setDraggedId(null);
    if (!quoteId) return;

    moveQuote(quoteId, status);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PipelineFilters
          salespeople={salespeople}
          assigneeId={assigneeId}
          onAssigneeChange={setAssigneeId}
        />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {pipelineStages.map((stage) => (
          <KanbanColumn
            key={stage.status}
            stage={stage}
            quotes={visibleQuotes.filter((quote) => quote.status === stage.status)}
            isDropTarget={dropTarget === stage.status}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={() => setDropTarget(null)}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
