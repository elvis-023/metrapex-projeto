import type { PipelineQuote } from "@/lib/pipeline/mock-data";
import { getQuotes, type QuoteListEntry } from "@/lib/quotes/queries";

/**
 * Adapta o orçamento persistido (Milestone 14) para o card do board, que já
 * existia com dados mockados (Milestone 7). A persistência do arrastar-e-soltar
 * e a timeline continuam pendentes — Milestone 16.
 */
function toPipelineQuote(entry: QuoteListEntry): PipelineQuote {
  return {
    id: entry.id,
    number: entry.number,
    customerName: entry.customerName,
    sourceId: entry.customerSourceId ?? "site",
    total: entry.total,
    status: entry.status,
    expiresAt: entry.expiresAt ?? "",
    assigneeId: entry.ownerId ?? "",
    assigneeName: entry.ownerName,
    revision: entry.revision,
    previousRevisionId: entry.previousRevisionId ?? undefined,
    supersededByRevisionId: entry.supersededByRevisionId ?? undefined,
  };
}

export async function getBoardQuotes(): Promise<PipelineQuote[]> {
  return (await getQuotes()).map(toPipelineQuote);
}
