import Link from "next/link";

import { Button } from "@/components/ui/button";
import { QuoteReceipt } from "@/components/marketing/quote-receipt";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="animate-orb-float pointer-events-none absolute -top-24 left-[8%] size-[400px] rounded-full blur-[80px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 20%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="animate-orb-float pointer-events-none absolute right-[8%] -bottom-24 size-[350px] rounded-full blur-[80px]"
        style={{
          animationDelay: "-4s",
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div className="flex flex-col items-start gap-6 text-left">
          <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
            Talão de orçamento nº 1 → nº ∞, sem parar de carimbar
          </p>

          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Do pedido do cliente ao orçamento carimbado, em segundos.
          </h1>

          <p className="text-muted-foreground max-w-lg text-lg text-balance">
            Um formulário público gera o orçamento em PDF na hora, com imposto e condição de
            pagamento já calculados. O time de vendas acompanha tudo num pipeline visual, sem
            planilha e sem cálculo manual.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              render={<Link href="/signup">Começar grátis</Link>}
              nativeButton={false}
            />
            <Button
              size="lg"
              variant="outline"
              render={<Link href="#features">Ver como funciona</Link>}
              nativeButton={false}
            />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <QuoteReceipt />
        </div>
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 2400 50"
        preserveAspectRatio="none"
        className="animate-wave-scroll pointer-events-none absolute bottom-0 left-0 h-[50px] w-[200%]"
      >
        <path
          d="M0,25 C200,50 400,0 600,25 C800,50 1000,0 1200,25 C1400,50 1600,0 1800,25 C2000,50 2200,0 2400,25 L2400,50 L0,50 Z"
          style={{ fill: "color-mix(in oklch, var(--primary) 7%, transparent)" }}
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 2400 35"
        preserveAspectRatio="none"
        className="animate-wave-scroll pointer-events-none absolute bottom-0 left-0 h-[35px] w-[200%]"
        style={{ animationDuration: "18s", animationDirection: "reverse" }}
      >
        <path
          d="M0,17 C150,35 300,0 450,17 C600,35 750,0 900,17 C1050,35 1200,0 1350,17 C1500,35 1650,0 1800,17 C1950,35 2100,0 2250,17 L2400,17 L2400,35 L0,35 Z"
          style={{ fill: "color-mix(in oklch, var(--primary) 5%, transparent)" }}
        />
      </svg>
    </section>
  );
}
