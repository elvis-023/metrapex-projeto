"use client";

import { useMemo, useState } from "react";
import { ImageOffIcon, MinusIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/states/empty-state";
import { CaptchaPlaceholder } from "@/components/public-form/captcha-placeholder";
import { HoneypotField } from "@/components/public-form/honeypot-field";
import { currencyFormatter } from "@/lib/catalog/format";
import type { Product } from "@/lib/catalog/types";
import type { PublicFormAction } from "@/lib/public-form/reducer";
import type { PublicFormState } from "@/lib/public-form/types";

export function StepProducts({
  state,
  dispatch,
  products,
  preloadedProductId,
}: {
  state: PublicFormState;
  dispatch: (action: PublicFormAction) => void;
  products: Product[];
  preloadedProductId: string | null;
}) {
  const [query, setQuery] = useState("");

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(normalized) ||
        product.externalCode.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  const subtotal = state.cart.reduce((sum, item) => {
    const product = productsById.get(item.productId);
    return product ? sum + product.price * item.quantity : sum;
  }, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Escolha os produtos</h2>
        <p className="text-muted-foreground text-sm">
          Adicione os itens que você quer no orçamento. Você pode ajustar a quantidade a qualquer
          momento.
        </p>
      </div>

      {preloadedProductId && state.cart.some((item) => item.productId === preloadedProductId) ? (
        <p className="border-primary/30 bg-primary/5 text-primary rounded-lg border px-3 py-2 text-xs">
          Produto pré-selecionado a partir do link que você acessou.
        </p>
      ) : null}

      {state.cart.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Seu carrinho</p>
          <div className="flex flex-col gap-1.5">
            {state.cart.map((item) => {
              const product = productsById.get(item.productId);
              if (!product) return null;
              return (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{product.name}</span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {currencyFormatter.format(product.price)} / un.
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Diminuir quantidade de ${product.name}`}
                      onClick={() =>
                        dispatch({
                          type: "SET_QUANTITY",
                          productId: item.productId,
                          quantity: item.quantity - 1,
                        })
                      }
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
                      aria-label={`Aumentar quantidade de ${product.name}`}
                      onClick={() =>
                        dispatch({
                          type: "SET_QUANTITY",
                          productId: item.productId,
                          quantity: item.quantity + 1,
                        })
                      }
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
                    {currencyFormatter.format(product.price * item.quantity)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover ${product.name}`}
                    onClick={() => dispatch({ type: "REMOVE_PRODUCT", productId: item.productId })}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex items-baseline justify-between px-1 pt-1">
            <span className="text-sm font-medium">Subtotal estimado</span>
            <span className="font-mono text-lg font-semibold tabular-nums">
              {currencyFormatter.format(subtotal)}
            </span>
          </div>
          <p className="text-muted-foreground px-1 text-xs">
            Valor sujeito a conferência de impostos e condições — o orçamento final vem no PDF que
            você recebe por e-mail.
          </p>
        </div>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Catálogo</p>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou código"
            className="pl-8"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca." />
        ) : (
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  {product.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.photoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOffIcon className="text-muted-foreground size-4" aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{product.name}</span>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {currencyFormatter.format(product.price)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Adicionar ${product.name}`}
                  onClick={() => dispatch({ type: "ADD_PRODUCT", productId: product.id })}
                >
                  <PlusIcon />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <HoneypotField
        value={state.honeypot}
        onChange={(value) => dispatch({ type: "SET_HONEYPOT", value })}
      />

      <CaptchaPlaceholder onVerified={(token) => dispatch({ type: "CAPTCHA_VERIFIED", token })} />
    </div>
  );
}
