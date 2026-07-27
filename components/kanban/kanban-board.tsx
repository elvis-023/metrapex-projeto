"use client";

import { useMemo, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { ALL_SALESPEOPLE, PipelineFilters } from "@/components/kanban/pipeline-filters";
import type { FakeQuoteStatus } from "@/lib/mock-data";
import { pipelineStages, resolveAssignee, type Salesperson } from "@/lib/pipeline/mock-data";
import { usePipelineQuotes } from "@/lib/pipeline/pipeline-context";
import { moveQuoteStageAction } from "@/lib/pipeline/actions";

export function KanbanBoard() {
  const { quotes, moveQuote } = usePipelineQuotes();
  const router = useRouter();
  const [, startMoving] = useTransition();
  const [assigneeId, setAssigneeId] = useState(ALL_SALESPEOPLE);
  const [dropTarget, setDropTarget] = useState<FakeQuoteStatus | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  /**
   * As opções do filtro saem dos próprios orçamentos do board, não de uma
   * lista fixa: desde a Milestone 14 o responsável é um `profiles.id` real, e
   * uma lista à parte voltaria a filtrar por id que não existe em orçamento
   * nenhum. Efeito colateral desejável: só aparece quem tem orçamento.
   */
  const salespeople = useMemo<Salesperson[]>(() => {
    const byId = new Map<string, Salesperson>();
    for (const quote of quotes) {
      if (!quote.assigneeId || byId.has(quote.assigneeId)) continue;
      const assignee = resolveAssignee(quote);
      byId.set(quote.assigneeId, { id: quote.assigneeId, ...assignee });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [quotes]);

  const visibleQuotes = useMemo(() => {
    // Revisões antigas ficam de fora do board — só a versão atual de cada
    // orçamento ocupa uma etapa do funil; o histórico continua acessível
    // pela página de detalhe (`QuoteDetail`).
    const currentRevisions = quotes.filter((quote) => !quote.supersededByRevisionId);
    return assigneeId === ALL_SALESPEOPLE
      ? currentRevisions
      : currentRevisions.filter((quote) => quote.assigneeId === assigneeId);
  }, [quotes, assigneeId]);

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

    const previousStatus = quotes.find((quote) => quote.id === quoteId)?.status;
    if (!previousStatus || previousStatus === status) return;

    // Otimista: o card muda de coluna na hora. A permissão de verdade (dono
    // do orçamento ou admin) é aplicada no banco (migration
    // 20260727000011_pipeline_backend.sql) — se o RPC recusar, o card volta
    // pra coluna original e o vendedor vê o motivo no toast.
    moveQuote(quoteId, status);

    startMoving(async () => {
      try {
        await moveQuoteStageAction(quoteId, status);
        router.refresh();
      } catch (error) {
        moveQuote(quoteId, previousStatus);
        toast.error(error instanceof Error ? error.message : "Não foi possível mover o orçamento.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PipelineFilters
          salespeople={salespeople}
          assigneeId={assigneeId}
          onAssigneeChange={setAssigneeId}
        />
        <Button
          size="sm"
          render={
            <Link href="/quotes/new">
              <PlusIcon />
              Novo orçamento
            </Link>
          }
          nativeButton={false}
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
