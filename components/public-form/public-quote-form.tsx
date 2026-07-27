"use client";

import { useReducer } from "react";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { StepDocument } from "@/components/public-form/step-document";
import { StepProducts } from "@/components/public-form/step-products";
import { StepConfirmation } from "@/components/public-form/step-confirmation";
import { cn } from "@/lib/utils";
import { initialPublicFormState, isStepValid, publicFormReducer } from "@/lib/public-form/reducer";
import { detectDocumentType } from "@/lib/public-form/cpf-cnpj";
import type { Product } from "@/lib/catalog/types";
import type { PublicFormStep } from "@/lib/public-form/types";

const STEPS: { step: PublicFormStep; label: string }[] = [
  { step: 1, label: "Identificação" },
  { step: 2, label: "Produtos" },
];

function StepProgress({ currentStep }: { currentStep: PublicFormStep }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Etapas do formulário">
      {STEPS.map(({ step, label }, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <li key={step} className="flex flex-1 items-center gap-1.5">
            <span aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-2">
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
                  "text-xs font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </span>
            {index < STEPS.length - 1 ? (
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

export function PublicQuoteForm({
  publicFormKey,
  organizationName,
  products,
  preloadedProductId,
}: {
  publicFormKey: string;
  organizationName: string;
  products: Product[];
  preloadedProductId: string | null;
}) {
  const [state, dispatch] = useReducer(
    publicFormReducer,
    preloadedProductId,
    initialPublicFormState,
  );

  const currentStepValid = isStepValid(state, state.step);

  async function handleSubmit() {
    dispatch({ type: "SUBMIT_START" });
    try {
      const response = await fetch("/api/public-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicFormKey,
          // Derivado do documento — o formulário não tem seletor de tipo.
          // `isStepValid` só libera o envio com o tipo já determinado.
          documentType: detectDocumentType(state.document),
          document: state.document,
          legalName: state.legalName,
          contactName: state.contactName,
          email: state.email,
          phone: state.phone,
          address: state.address,
          cart: state.cart,
          honeypot: state.honeypot,
          captchaToken: state.captchaToken,
        }),
      });

      const body = (await response.json()) as { quoteNumber?: string; error?: string };

      if (!response.ok || !body.quoteNumber) {
        throw new Error(body.error ?? "Não foi possível gerar o orçamento. Tente novamente.");
      }

      dispatch({ type: "SUBMIT_SUCCESS", protocolNumber: body.quoteNumber });
    } catch (error) {
      dispatch({
        type: "SUBMIT_ERROR",
        message: error instanceof Error ? error.message : "Não foi possível gerar o orçamento.",
      });
    }
  }

  if (state.submitted) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-muted-foreground text-sm">{organizationName}</p>
        </CardHeader>
        <CardContent>
          <StepConfirmation
            state={state}
            products={products}
            onReset={() => dispatch({ type: "RESET", preloadedProductId })}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="gap-4 border-b pb-4">
        <p className="text-muted-foreground text-sm">
          Orçamento — <span className="font-medium">{organizationName}</span>
        </p>
        <StepProgress currentStep={state.step} />
      </CardHeader>
      <CardContent className="py-2">
        {state.step === 1 ? <StepDocument state={state} dispatch={dispatch} /> : null}
        {state.step === 2 ? (
          <StepProducts
            state={state}
            dispatch={dispatch}
            products={products}
            preloadedProductId={preloadedProductId}
          />
        ) : null}
      </CardContent>
      {state.submitError ? (
        <p className="text-destructive px-6 text-sm" role="alert">
          {state.submitError}
        </p>
      ) : null}
      <CardFooter className="justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={state.step === 1}
          onClick={() => dispatch({ type: "BACK" })}
        >
          Voltar
        </Button>
        {state.step === 1 ? (
          <Button
            type="button"
            disabled={!currentStepValid}
            onClick={() => dispatch({ type: "NEXT" })}
          >
            Avançar
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!currentStepValid || state.submitting}
            onClick={handleSubmit}
          >
            {state.submitting ? "Enviando…" : "Solicitar orçamento"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
