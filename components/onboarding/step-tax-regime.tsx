"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/lib/catalog/format";
import { taxRegimeOptions } from "@/lib/onboarding/mock-data";
import { parseBrRate } from "@/lib/tax-engine/onboarding-templates";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepTaxRegimeProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

/** MEI e Simples Nacional não têm alíquota a configurar — mesma tela de ajuste pros dois. */
const REGIMES_SEM_DESTAQUE = new Set(["mei", "simples_nacional"]);

/**
 * Exemplo ILUSTRATIVO da comparação indústria x revenda (ICMS-ST) — número
 * fixo/mockado só pra ilustrar o conceito nesta tela, sem nenhuma ligação com
 * o motor de impostos real (resolveRate/calcTax nunca são chamados aqui).
 * A alíquota de ICMS usada no exemplo é fixa de propósito: o campo de ICMS
 * foi removido desta tela (simplificação do onboarding — a configuração real
 * de ICMS continua em Configurações > Impostos).
 */
const EXAMPLE_BASE_PRICE = 100;
const EXAMPLE_ICMS_RATE = 18;

export function StepTaxRegime({ state, dispatch }: StepTaxRegimeProps) {
  const { taxRegime } = state;
  const selectedOption = taxRegimeOptions.find((option) =>
    option.matches.includes(taxRegime.regime),
  );
  const semDestaque = REGIMES_SEM_DESTAQUE.has(taxRegime.regime);

  const ipiRate = parseBrRate(taxRegime.ipiCategoryRate);
  const industriaPrice = EXAMPLE_BASE_PRICE * (1 + EXAMPLE_ICMS_RATE / 100 + ipiRate / 100);
  const revendaPrice = EXAMPLE_BASE_PRICE * (1 + ipiRate / 100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Regime Tributário</h2>
        <p className="text-muted-foreground text-sm">
          Ponto de partida configurável — nada aqui é fixo, ajuste depois em Configurações.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {taxRegimeOptions.map((option) => {
          const isSelected = option.matches.includes(taxRegime.regime);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => dispatch({ type: "SET_TAX_REGIME", regime: option.id })}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                {isSelected ? <Badge variant="default">Selecionado</Badge> : null}
                {isSelected && taxRegime.autoDetected ? (
                  <Badge variant="secondary">Detectado pelo CNPJ — confirme ou altere</Badge>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">{option.description}</span>
            </button>
          );
        })}
      </div>

      <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-lg border border-dashed p-3">
        <p className="text-muted-foreground text-xs">{selectedOption?.helpText}</p>

        {semDestaque ? (
          <>
            <p className="text-sm font-medium">
              Nenhum tributo será destacado neste orçamento — o valor cobrado é o preço de catálogo.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="footer-text" className="text-sm font-medium">
                Texto do rodapé
              </label>
              <textarea
                id="footer-text"
                rows={2}
                value={taxRegime.footerText}
                onChange={(event) =>
                  dispatch({
                    type: "SET_TAX_FIELD",
                    field: "footerText",
                    value: event.target.value,
                  })
                }
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
              />
            </div>

            {/* Em vez de deixar a tela de ajuste vazia pra quem não tem
                alíquota nenhuma a configurar, mostra o resultado concreto de
                escolher este regime: como a linha do orçamento sai e o que
                aparece no rodapé. */}
            <div className="bg-background rounded-md border px-3 py-2">
              <p className="text-muted-foreground mb-1.5 text-[0.65rem] tracking-wide uppercase">
                Prévia do orçamento
              </p>
              <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span>Produto exemplo — 1 × R$ 100,00</span>
                <span className="font-mono tabular-nums">R$ 100,00</span>
              </div>
              {taxRegime.footerText ? (
                <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
                  {taxRegime.footerText}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ipi-rate" className="text-sm font-medium">
                IPI — categoria industrializados (%)
              </label>
              <input
                id="ipi-rate"
                value={taxRegime.ipiCategoryRate}
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
                produtos industrializados depois, em Configurações &gt; Impostos, e confirme com o
                contador antes de emitir orçamento com valor oficial. A alíquota de ICMS também fica
                para lá — cada estado tem a sua, então o ajuste fino não faz sentido aqui no
                onboarding.
              </p>
            </div>

            {/* Exemplo ilustrativo, não ligado ao motor de cálculo (ver
                comentário de EXAMPLE_BASE_PRICE acima) — só pra o usuário
                entender, antes de configurar o catálogo, por que o mesmo
                produto pode sair com preço diferente pra revenda. */}
            <div className="bg-background rounded-md border px-3 py-2">
              <p className="text-muted-foreground mb-1.5 text-[0.65rem] tracking-wide uppercase">
                Exemplo ilustrativo — valores fixos, não é o cálculo do seu orçamento
              </p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Preço para Indústria (Consumidor Final)</span>
                  <div className="flex items-baseline justify-between">
                    <span>Produto exemplo</span>
                    <span className="font-mono tabular-nums">
                      {currencyFormatter.format(industriaPrice)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    ICMS {EXAMPLE_ICMS_RATE}% + IPI {taxRegime.ipiCategoryRate || "0"}% por fora.
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Preço para Comercialização (Revenda)</span>
                  <div className="flex items-baseline justify-between">
                    <span>Produto exemplo</span>
                    <span className="font-mono tabular-nums">
                      {currencyFormatter.format(revendaPrice)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    ICMS 0% — ICMS-ST recolhido pelo fabricante. IPI{" "}
                    {taxRegime.ipiCategoryRate || "0"}% por fora.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
