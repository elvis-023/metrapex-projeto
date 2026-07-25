"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/lib/catalog/format";
import {
  computeQuoteSubtotals,
  paymentConditionOptions,
  resolveDiscountAmount,
} from "@/lib/quotes/mock-data";
import type { QuoteDiscount, QuoteLineItem } from "@/lib/quotes/types";

export function QuoteTotalsCard({
  items,
  discount,
  onDiscountChange,
  paymentConditionId,
  onPaymentConditionChange,
}: {
  items: QuoteLineItem[];
  discount: QuoteDiscount;
  onDiscountChange: (value: QuoteDiscount) => void;
  paymentConditionId: string;
  onPaymentConditionChange: (value: string) => void;
}) {
  const { subtotal, taxTotalsByCode, discountAmount, total } = useMemo(() => {
    const { subtotal, exclusiveAddOn } = computeQuoteSubtotals(items);

    const taxTotals = new Map<
      string,
      { label: string; mode: QuoteLineItem["taxes"][number]["mode"]; amount: number }
    >();
    for (const item of items) {
      for (const tax of item.taxes) {
        const existing = taxTotals.get(tax.code);
        if (existing) {
          existing.amount += tax.amount;
        } else {
          taxTotals.set(tax.code, { label: tax.label, mode: tax.mode, amount: tax.amount });
        }
      }
    }

    const discountAmount = resolveDiscountAmount(items, discount);

    return {
      subtotal,
      taxTotalsByCode: Array.from(taxTotals.entries()).map(([code, value]) => ({
        code,
        ...value,
      })),
      discountAmount,
      total: Math.max(0, subtotal + exclusiveAddOn - discountAmount),
    };
  }, [items, discount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisão</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono tabular-nums">{currencyFormatter.format(subtotal)}</span>
        </div>

        {taxTotalsByCode.length > 0 ? (
          <div className="flex flex-col gap-1">
            {taxTotalsByCode.map((tax) => (
              <div key={tax.code} className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {tax.label} {tax.mode === "inclusive" ? "(embutido no preço)" : "(por fora)"}
                </span>
                <span className="font-mono tabular-nums">
                  {currencyFormatter.format(tax.amount)}
                </span>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              Impostos embutidos já estão no subtotal — só os &ldquo;por fora&rdquo; somam ao total
              a pagar.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Nenhum imposto destacado neste orçamento.</p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="quote-discount" className="text-sm font-medium">
              Desconto negociado
            </label>
            <div className="flex items-center gap-1.5">
              <div className="border-input inline-flex overflow-hidden rounded-lg border">
                <button
                  type="button"
                  aria-pressed={discount.type === "fixed"}
                  onClick={() => onDiscountChange({ type: "fixed", value: 0 })}
                  className={cn(
                    "px-2 py-1 text-xs font-medium transition-colors",
                    discount.type === "fixed"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  R$
                </button>
                <button
                  type="button"
                  aria-pressed={discount.type === "percent"}
                  onClick={() => onDiscountChange({ type: "percent", value: 0 })}
                  className={cn(
                    "border-input border-l px-2 py-1 text-xs font-medium transition-colors",
                    discount.type === "percent"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  %
                </button>
              </div>
              <div className="relative w-24">
                {discount.type === "fixed" ? (
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
                    R$
                  </span>
                ) : null}
                <Input
                  id="quote-discount"
                  inputMode="decimal"
                  value={discount.value === 0 ? "" : String(discount.value).replace(".", ",")}
                  placeholder={discount.type === "percent" ? "0" : "0,00"}
                  onChange={(event) => {
                    const normalized = event.target.value.replace(",", ".");
                    const value = Number(normalized);
                    onDiscountChange({
                      type: discount.type,
                      value: Number.isFinite(value) ? Math.max(0, value) : 0,
                    });
                  }}
                  className={cn(
                    "text-right tabular-nums",
                    discount.type === "fixed" && "pl-8",
                    discount.type === "percent" && "pr-6",
                  )}
                />
                {discount.type === "percent" ? (
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm">
                    %
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {discount.type === "percent" && discountAmount > 0 ? (
            <p className="text-muted-foreground self-end text-xs">
              Equivale a {currencyFormatter.format(discountAmount)}
            </p>
          ) : null}
        </div>

        <Separator />

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="font-mono text-xl font-semibold tabular-nums">
            {currencyFormatter.format(total)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="payment-condition" className="text-sm font-medium">
            Condição de pagamento
          </label>
          <Select
            value={paymentConditionId}
            onValueChange={(value) => value && onPaymentConditionChange(value)}
          >
            <SelectTrigger id="payment-condition" className="w-full">
              <SelectValue>
                {(value: string) =>
                  paymentConditionOptions.find((option) => option.id === value)?.label ?? "—"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {paymentConditionOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
