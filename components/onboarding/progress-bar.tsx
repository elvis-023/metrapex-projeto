"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding/types";

type ProgressBarProps = {
  currentStep: OnboardingStep;
  furthestStepReached: OnboardingStep;
  onStepClick: (step: OnboardingStep) => void;
};

export function ProgressBar({ currentStep, furthestStepReached, onStepClick }: ProgressBarProps) {
  return (
    <ol className="flex items-center gap-1.5">
      {ONBOARDING_STEPS.map(({ step, label }, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const isReachable = step <= furthestStepReached;

        return (
          <li key={step} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => onStepClick(step)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors disabled:cursor-not-allowed",
                isReachable && !isCurrent && "hover:bg-muted cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isCompleted && !isCurrent && "border-border text-muted-foreground",
                )}
              >
                {isCompleted ? <CheckIcon className="size-3.5" /> : step}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:inline",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
            {index < ONBOARDING_STEPS.length - 1 ? (
              <span
                className={cn("h-px flex-1", isCompleted ? "bg-primary" : "bg-border")}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
