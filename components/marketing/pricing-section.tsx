import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Freelancer",
    description: "Para consultor solo ou autônomo começando com um workspace.",
    price: "R$ 49",
    period: "/mês",
    features: [
      "1 vendedor",
      "Até 30 orçamentos por mês",
      "Formulário público incorporável",
      "Envio por e-mail",
    ],
    highlighted: false,
  },
  {
    name: "Time",
    description: "Para pequenas e médias empresas com um time de vendas.",
    price: "R$ 149",
    period: "/mês",
    features: [
      "Até 5 vendedores",
      "Até 200 orçamentos por mês",
      "Envio por e-mail e WhatsApp",
      "Relatórios e exportação",
    ],
    highlighted: true,
  },
  {
    name: "Empresa",
    description: "Para operações maiores, com múltiplas organizações.",
    price: "Sob consulta",
    period: "",
    features: [
      "Vendedores ilimitados",
      "Volume de orçamentos sob medida",
      "Múltiplas organizações",
      "Onboarding assistido",
    ],
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
          Condições de pagamento
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Planos e preços</h2>
        <p className="text-muted-foreground mt-3 text-balance">
          Por número de vendedores e volume de orçamentos mensais. Sem fidelidade, cancele quando
          quiser.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={cn(plan.highlighted && "ring-primary ring-2")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.highlighted && <Badge>Popular</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-3xl font-semibold tabular-nums">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
                render={<Link href="/signup">Começar</Link>}
                nativeButton={false}
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
