"use client";

import { Button } from "@/components/ui/button";
import { currencyFormatter } from "@/lib/catalog/format";
import type { Product } from "@/lib/catalog/types";
import type { PublicFormState } from "@/lib/public-form/types";

export function StepConfirmation({
  state,
  products,
  onReset,
}: {
  state: PublicFormState;
  products: Product[];
  onReset: () => void;
}) {
  const productsById = new Map(products.map((p) => [p.id, p]));
  const items = state.cart
    .map((item) => ({ item, product: productsById.get(item.productId) }))
    .filter((entry): entry is { item: (typeof state.cart)[number]; product: Product } =>
      Boolean(entry.product),
    );
  const total = items.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="perforated-top bg-card text-card-foreground ring-foreground/10 relative w-full max-w-sm rounded-lg pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.25)] ring-1">
        <div className="flex items-start justify-between px-5">
          <div>
            <p className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
              Protocolo
            </p>
            <p className="font-mono text-lg font-medium tabular-nums">{state.protocolNumber}</p>
          </div>
          <div
            className="stamp-seal border-primary text-primary flex flex-col items-center justify-center rounded-full border-2 px-3 py-2 text-center leading-none"
            aria-hidden="true"
          >
            <span className="text-[0.6rem] font-bold tracking-[0.08em]">RECEBIDO</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-y px-5 py-4">
          {items.map(({ item, product }) => (
            <div key={item.productId} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{product.name}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {item.quantity}x
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                {currencyFormatter.format(product.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between px-5 py-4">
          <span className="text-sm font-medium">Total estimado</span>
          <span className="font-mono text-xl font-semibold tabular-nums">
            {currencyFormatter.format(total)}
          </span>
        </div>

        <div className="text-muted-foreground border-t px-5 py-3 text-[0.7rem]">
          Enviamos o orçamento em PDF para <span className="font-medium">{state.email}</span>.
        </div>
      </div>

      <p className="text-muted-foreground max-w-sm text-center text-sm">
        Pedido recebido! Confira sua caixa de entrada (e o spam) — o orçamento chega em instantes.
      </p>

      <Button type="button" variant="outline" onClick={onReset}>
        Solicitar outro orçamento
      </Button>
    </div>
  );
}
