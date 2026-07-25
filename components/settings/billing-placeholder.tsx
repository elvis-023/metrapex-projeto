import { CheckIcon, CreditCardIcon, ConstructionIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/settings/types";

function limitLabel(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : "Ilimitado";
}

export function BillingPlaceholder({
  currentPlan,
  plans,
}: {
  currentPlan: PlanTier;
  plans: PlanTier[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-muted/30 flex items-start gap-2.5 rounded-lg border border-dashed p-3">
        <ConstructionIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Placeholder — sem Stripe conectado</p>
          <p className="text-muted-foreground text-xs">
            Esta tela ainda não faz checkout, troca de plano ou cobrança de verdade. O
            fluxo real de assinatura entra no Milestone 21.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Plano atual</CardTitle>
            <CardDescription>
              Limite de vendedores e de orçamentos mensais do plano contratado.
            </CardDescription>
          </div>
          <Badge>{currentPlan.name}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Preço</span>
              <span className="font-mono text-sm font-medium tabular-nums">
                {currentPlan.priceLabel}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Vendedores</span>
              <span className="font-mono text-sm font-medium tabular-nums">
                {limitLabel(currentPlan.sellerLimit)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">Orçamentos/mês</span>
              <span className="font-mono text-sm font-medium tabular-nums">
                {limitLabel(currentPlan.monthlyQuoteLimit)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button disabled className="w-fit">
              <CreditCardIcon />
              Gerenciar assinatura
            </Button>
            <p className="text-muted-foreground text-xs">
              Checkout e portal de assinatura chegam no Milestone 21 (Stripe) — troca de plano,
              atualização de cartão e cancelamento ainda não são possíveis aqui.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos disponíveis</CardTitle>
          <CardDescription>Por número de vendedores e volume de orçamentos mensais.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan.id;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3",
                    isCurrent ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{plan.name}</span>
                    {isCurrent ? <Badge variant="outline">Atual</Badge> : null}
                  </div>
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {plan.priceLabel}
                  </span>
                  <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                    <li className="flex items-start gap-1.5">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {limitLabel(plan.sellerLimit)} vendedor(es)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {limitLabel(plan.monthlyQuoteLimit)} orçamentos/mês
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      Envio por e-mail{plan.whatsappIncluded ? " e WhatsApp" : ""}
                    </li>
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
