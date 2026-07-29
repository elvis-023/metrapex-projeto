import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="bg-primary text-primary-foreground flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance">
          Pare de perder venda por demora no orçamento
        </h2>
        <p className="max-w-xl text-balance opacity-90">
          Configure seu catálogo e seus impostos uma vez. O resto — cálculo, PDF e envio — o Trezofy
          faz sozinho.
        </p>
        <Button
          size="lg"
          variant="secondary"
          render={<Link href="/signup">Começar grátis</Link>}
          nativeButton={false}
        />
      </div>
    </section>
  );
}
