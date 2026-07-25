"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { embedSnippet } from "@/lib/onboarding/mock-data";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepSnippetProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

export function StepSnippet({ state, dispatch }: StepSnippetProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(embedSnippet);
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) — segue sem bloquear o fluxo mockado
    }
    dispatch({ type: "MARK_SNIPPET_COPIED" });
    toast.success("Snippet copiado para a área de transferência.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Instalar o formulário no site</h2>
        <p className="text-muted-foreground text-sm">
          Cole este trecho antes do <code className="text-xs">{"</body>"}</code> do seu site para
          incorporar o formulário público de orçamento.
        </p>
      </div>

      <div className="relative">
        <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
          {embedSnippet}
        </pre>
        <Button
          type="button"
          size="sm"
          variant={state.snippet.copied ? "secondary" : "default"}
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {state.snippet.copied ? <CheckIcon /> : <CopyIcon />}
          {state.snippet.copied ? "Copiado" : "Copiar"}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Precisa de outro produto específico pré-carregado? Adicione{" "}
        <code className="text-xs">?produto=CODIGO</code> à URL do formulário.
      </p>
    </div>
  );
}
