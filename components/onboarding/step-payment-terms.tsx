"use client";

import { cn } from "@/lib/utils";
import { paymentConditionOptions } from "@/lib/onboarding/mock-data";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepPaymentTermsProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

export function StepPaymentTerms({ state, dispatch }: StepPaymentTermsProps) {
  const { payment } = state;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Condições de pagamento</h2>
        <p className="text-muted-foreground text-sm">
          Sugestão-padrão já pré-preenchida — ajuste ou confirme como está.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {paymentConditionOptions.map((option) => {
          const isSelected = payment.conditionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => dispatch({ type: "SET_PAYMENT_CONDITION", conditionId: option.id })}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-muted-foreground text-xs">{option.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="payment-note" className="text-sm font-medium">
          Faixa de valor e observações
        </label>
        <textarea
          id="payment-note"
          rows={2}
          value={payment.note}
          onChange={(event) => dispatch({ type: "SET_PAYMENT_NOTE", value: event.target.value })}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
        />
      </div>
    </div>
  );
}
