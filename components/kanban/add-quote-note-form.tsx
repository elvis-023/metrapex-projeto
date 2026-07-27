"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addQuoteNoteAction } from "@/lib/pipeline/actions";

/**
 * Só renderizada quando `canEdit` (dono do orçamento, admin, ou orçamento sem
 * responsável — ver `QuoteDetailPage`) é verdadeiro. A permissão de verdade é
 * imposta no banco (`add_quote_note`, migration
 * 20260727000011_pipeline_backend.sql); esconder o campo aqui é só evitar um
 * erro previsível na cara de quem não pode escrever.
 */
export function AddQuoteNoteForm({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState("");
  const [isSaving, startSaving] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = detail.trim();
    if (!trimmed) return;

    startSaving(async () => {
      try {
        await addQuoteNoteAction(quoteId, trimmed);
        setDetail("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a nota.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="Adicionar uma nota ao orçamento…"
        rows={2}
        disabled={isSaving}
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isSaving || detail.trim() === ""}
        className="self-end"
      >
        <SendIcon />
        {isSaving ? "Salvando…" : "Adicionar nota"}
      </Button>
    </form>
  );
}
