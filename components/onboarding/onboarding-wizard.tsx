"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { StepOrganization } from "@/components/onboarding/step-organization";
import { StepTaxTemplate } from "@/components/onboarding/step-tax-template";
import { StepCatalog } from "@/components/onboarding/step-catalog";
import { StepPaymentTerms } from "@/components/onboarding/step-payment-terms";
import { StepSnippet } from "@/components/onboarding/step-snippet";
import { STORAGE_KEY, initialOnboardingState } from "@/lib/onboarding/mock-data";
import { isStepValid, onboardingReducer } from "@/lib/onboarding/reducer";
import type { OnboardingState, OnboardingStep } from "@/lib/onboarding/types";

function loadInitialState(): OnboardingState {
  if (typeof window === "undefined") return initialOnboardingState;

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return initialOnboardingState;
    return { ...initialOnboardingState, ...JSON.parse(stored) } as OnboardingState;
  } catch {
    return initialOnboardingState;
  }
}

export function OnboardingWizard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(onboardingReducer, undefined, loadInitialState);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentStepValid = isStepValid(state, state.step);
  const isLastStep = state.step === 5;

  function handleFinish() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    toast.success("Organização configurada. Bem-vindo ao painel!");
    router.push("/dashboard");
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="gap-4 border-b pb-4">
        <ProgressBar
          currentStep={state.step}
          furthestStepReached={state.furthestStepReached}
          onStepClick={(step: OnboardingStep) => dispatch({ type: "JUMP_TO", step })}
        />
      </CardHeader>
      <CardContent className="py-2">
        {state.step === 1 ? <StepOrganization state={state} dispatch={dispatch} /> : null}
        {state.step === 2 ? <StepTaxTemplate state={state} dispatch={dispatch} /> : null}
        {state.step === 3 ? <StepCatalog state={state} dispatch={dispatch} /> : null}
        {state.step === 4 ? <StepPaymentTerms state={state} dispatch={dispatch} /> : null}
        {state.step === 5 ? <StepSnippet state={state} dispatch={dispatch} /> : null}
      </CardContent>
      <CardFooter className="justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={state.step === 1}
          onClick={() => dispatch({ type: "BACK" })}
        >
          Voltar
        </Button>
        <div className="flex gap-1.5">
          {!isLastStep ? (
            <Button type="button" variant="ghost" onClick={() => dispatch({ type: "SKIP" })}>
              Pular
            </Button>
          ) : null}
          {isLastStep ? (
            <Button type="button" onClick={handleFinish}>
              Concluir e ir para o painel
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!currentStepValid}
              onClick={() => dispatch({ type: "NEXT" })}
            >
              Avançar
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
