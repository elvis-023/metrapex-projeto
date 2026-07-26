"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { StampIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { issueQuoteAction } from "@/lib/quotes/actions";

/**
 * Emitir congela o documento: depois disto preço, imposto e condição de
 * pagamento não mudam mais nem se a configuração da organização mudar, e o
 * banco recusa qualquer reescrita. Alterar exige revisão nova — por isso o
 * texto avisa antes, e não depois.
 */
export function IssueQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [isIssuing, startIssuing] = useTransition();

  function handleIssue() {
    startIssuing(async () => {
      try {
        await issueQuoteAction(quoteId);
        toast.success("Orçamento emitido — valores congelados.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível emitir.");
      }
    });
  }

  return (
    <Button type="button" size="sm" onClick={handleIssue} disabled={isIssuing}>
      <StampIcon />
      {isIssuing ? "Emitindo…" : "Emitir orçamento"}
    </Button>
  );
}
