"use client";

import { ImageOffIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { currencyFormatter } from "@/lib/catalog/format";
import type { QuoteLineItem } from "@/lib/quotes/types";

export function QuoteLineItems({
  items,
  onChangeQuantity,
  onRemove,
}: {
  items: QuoteLineItem[];
  onChangeQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum produto adicionado"
        description="Adicione produtos do catálogo para montar o orçamento."
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <div key={item.productId} className="flex flex-col gap-2 rounded-lg border px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
              {item.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photoUrl} alt="" className="size-full object-cover" />
              ) : (
                <ImageOffIcon className="text-muted-foreground size-4" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {item.externalCode} · {currencyFormatter.format(item.unitPrice)}/un.
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Diminuir quantidade"
                onClick={() => onChangeQuantity(item.productId, item.quantity - 1)}
              >
                <MinusIcon />
              </Button>
              <span className="w-6 text-center font-mono text-sm tabular-nums">
                {item.quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Aumentar quantidade"
                onClick={() => onChangeQuantity(item.productId, item.quantity + 1)}
              >
                <PlusIcon />
              </Button>
            </div>

            <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
              {currencyFormatter.format(item.lineTotal)}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover ${item.name}`}
              onClick={() => onRemove(item.productId)}
            >
              <Trash2Icon />
            </Button>
          </div>

          {item.taxes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-13 text-xs">
              {item.taxes.map((tax) => (
                <div key={tax.taxTypeId} className="flex items-center gap-1">
                  <Badge variant={tax.source === "product" ? "outline" : "secondary"}>
                    {tax.label} {tax.rate}%
                  </Badge>
                  <span className="text-muted-foreground font-mono tabular-nums">
                    {currencyFormatter.format(tax.amount)}
                    {tax.mode === "inclusive" ? " (embutido)" : " (por fora)"}
                  </span>
                  {tax.note ? <span className="text-muted-foreground">— {tax.note}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
