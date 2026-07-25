import { currencyFormatter } from "@/lib/catalog/format";
import {
  computeQuoteSubtotals,
  paymentConditionOptions,
  resolveDiscountAmount,
} from "@/lib/quotes/mock-data";
import type { QuoteDiscount, QuoteLineItem } from "@/lib/quotes/types";
import type { Customer } from "@/lib/customers/types";

/**
 * Layout estático do PDF — reaproveita o vocabulário visual do talão
 * (`components/marketing/quote-receipt.tsx`: borda perfurada, numeração
 * mono) porque esta tela É a representação do documento que sai como
 * PDF de verdade, não um elemento decorativo a mais. Sem o selo/animação
 * de carimbo — esse gesto já é usado na landing (ver CLAUDE.md >
 * Identidade visual, "reservar para um único lugar por tela").
 */
export function QuotePdfPreview({
  number,
  revision,
  customer,
  items,
  discount,
  paymentConditionId,
}: {
  number: string;
  revision: number;
  customer: Customer | null;
  items: QuoteLineItem[];
  discount: QuoteDiscount;
  paymentConditionId: string;
}) {
  const { subtotal, exclusiveAddOn } = computeQuoteSubtotals(items);
  const discountAmount = resolveDiscountAmount(items, discount);
  const total = Math.max(0, subtotal + exclusiveAddOn - discountAmount);
  const paymentCondition = paymentConditionOptions.find(
    (option) => option.id === paymentConditionId,
  );

  return (
    <div className="perforated-top bg-card text-card-foreground ring-foreground/10 relative w-full rounded-lg pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.25)] ring-1">
      <div className="flex items-start justify-between px-5">
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
            Orçamento{revision > 1 ? ` — revisão ${revision}` : ""}
          </p>
          <p className="font-mono text-lg font-medium tabular-nums">Nº {number}</p>
        </div>
        <span className="border-border text-muted-foreground rounded-full border px-2.5 py-1 text-[0.65rem] font-medium tracking-wide uppercase">
          Prévia
        </span>
      </div>

      <div className="text-muted-foreground flex flex-col gap-0.5 px-5 pt-3 text-sm">
        <span className="text-foreground font-medium">
          {customer?.name ?? "Cliente não selecionado"}
        </span>
        {customer ? <span className="tabular-nums">{customer.document}</span> : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-y px-5 py-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum item adicionado ainda.</p>
        ) : (
          items.map((item) => (
            <div key={item.productId} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {item.quantity}x
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {currencyFormatter.format(item.lineTotal)}
                </span>
              </div>
              {item.taxes.map((tax) => (
                <div
                  key={tax.taxTypeId}
                  className="text-muted-foreground flex items-baseline justify-between gap-3 pl-3 text-xs"
                >
                  <span className="truncate">
                    {tax.label} ({tax.rate}%{tax.note ? ` — ${tax.note}` : ""})
                  </span>
                  <span className="font-mono tabular-nums">
                    {currencyFormatter.format(tax.amount)}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}

        {discountAmount > 0 ? (
          <div className="text-danger flex items-baseline justify-between gap-3 text-sm">
            <span>
              Desconto negociado{discount.type === "percent" ? ` (${discount.value}%)` : ""}
            </span>
            <span className="font-mono tabular-nums">
              −{currencyFormatter.format(discountAmount)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between px-5 py-4">
        <span className="text-sm font-medium">Total</span>
        <span className="font-mono text-xl font-semibold tabular-nums">
          {currencyFormatter.format(total)}
        </span>
      </div>

      <div className="text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-[0.65rem]">
        <span>{paymentCondition?.label ?? "Condição de pagamento não definida"}</span>
        <span className="font-mono">PDF ↗</span>
      </div>
    </div>
  );
}
