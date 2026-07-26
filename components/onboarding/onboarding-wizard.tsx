"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createOrganizationAction } from "@/lib/organizations/actions";
import { applyPaymentDefaultsAction, applyTaxTemplateAction } from "@/lib/tax-engine/actions";

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
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentStepValid = isStepValid(state, state.step);
  const isLastStep = state.step === 5;

  async function handleFinish() {
    setIsFinishing(true);
    try {
      const { orgId } = await createOrganizationAction(state.organization.name);
      await applyTaxTemplateAction(orgId, {
        templateId: state.taxTemplate.templateId,
        icmsRate: state.taxTemplate.icmsRate,
        footerText: state.taxTemplate.footerText,
      });
      await applyPaymentDefaultsAction(orgId);
      window.sessionStorage.removeItem(STORAGE_KEY);
      toast.success("Organização configurada. Bem-vindo ao painel!");
      router.push("/dashboard");
    } catch {
      setIsFinishing(false);
      toast.error("Não foi possível criar a organização. Tente novamente.");
    }
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
            <Button type="button" onClick={handleFinish} disabled={isFinishing}>
              {isFinishing ? "Criando organização..." : "Concluir e ir para o painel"}
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
