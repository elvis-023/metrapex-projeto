import Link from "next/link";

import { Button } from "@/components/ui/button";
import { QuoteReceipt } from "@/components/marketing/quote-receipt";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
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
    </section>
  );
}
