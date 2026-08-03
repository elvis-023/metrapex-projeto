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
          Marque as condições que você realmente trabalha — desmarque o que não se aplica.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {paymentConditionOptions.map((option) => {
          const isSelected = payment.conditionIds.includes(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() =>
                  dispatch({ type: "TOGGLE_PAYMENT_CONDITION", conditionId: option.id })
                }
                className="accent-primary mt-0.5 size-4 rounded-[calc(var(--radius)-2px)]"
                aria-label={option.label}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
