"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { taxTemplateOptions } from "@/lib/onboarding/mock-data";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepTaxTemplateProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

export function StepTaxTemplate({ state, dispatch }: StepTaxTemplateProps) {
  const { taxTemplate } = state;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Template fiscal</h2>
        <p className="text-muted-foreground text-sm">
          Ponto de partida configurável — nada aqui é fixo, ajuste depois em Configurações.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {taxTemplateOptions.map((option) => {
          const isSelected = taxTemplate.templateId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => dispatch({ type: "SET_TAX_TEMPLATE", templateId: option.id })}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                {isSelected ? <Badge variant="default">Selecionado</Badge> : null}
              </span>
              <span className="text-muted-foreground text-xs">{option.description}</span>
            </button>
          );
        })}
      </div>

      <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-lg border border-dashed p-3">
        <p className="text-muted-foreground text-xs">
          {taxTemplateOptions.find((option) => option.id === taxTemplate.templateId)?.helpText}
        </p>

        {taxTemplate.templateId === "icms-ipi" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="icms-rate" className="text-sm font-medium">
                ICMS padrão (%)
              </label>
              <input
                id="icms-rate"
                value={taxTemplate.icmsRate}
                onChange={(event) =>
                  dispatch({ type: "SET_TAX_FIELD", field: "icmsRate", value: event.target.value })
                }
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm tabular-nums outline-none focus-visible:ring-3"
              />
              <p className="text-muted-foreground text-xs">
                Aplicado por fora, exceto override por produto.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ipi-rate" className="text-sm font-medium">
                IPI — categoria industrializados (%)
              </label>
              <input
                id="ipi-rate"
                value={taxTemplate.ipiCategoryRate}
                onChange={(event) =>
                  dispatch({
                    type: "SET_TAX_FIELD",
                    field: "ipiCategoryRate",
                    value: event.target.value,
                  })
                }
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm tabular-nums outline-none focus-visible:ring-3"
              />
              <p className="text-muted-foreground text-xs">
                Valor de referência — o IPI é criado com 0% e sem categoria vinculada, porque o
                catálogo ainda não existe neste passo. Aplique esta alíquota na categoria de
                produtos industrializados depois, em Configurações &gt; Impostos.
              </p>
            </div>
          </div>
        ) : null}

        {taxTemplate.templateId === "simples" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="footer-text" className="text-sm font-medium">
              Texto do rodapé
            </label>
            <textarea
              id="footer-text"
              rows={2}
              value={taxTemplate.footerText}
              onChange={(event) =>
                dispatch({ type: "SET_TAX_FIELD", field: "footerText", value: event.target.value })
              }
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
            />
          </div>
        ) : null}

        {taxTemplate.templateId === "isento" ? (
          <p className="text-muted-foreground text-xs">
            Nenhum tributo e nenhum rodapé são impressos no orçamento — zero tributos é configuração
            normal, não um estado a corrigir.
          </p>
        ) : null}
      </div>
    </div>
  );
}
