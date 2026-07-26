import { currencyFormatter } from "@/lib/catalog/format";
import type { QuoteDiscount, QuoteView } from "@/lib/quotes/types";

/**
 * Layout estático do PDF — reaproveita o vocabulário visual do talão
 * (`components/marketing/quote-receipt.tsx`: borda perfurada, numeração
 * mono) porque esta tela É a representação do documento que sai como
 * PDF de verdade, não um elemento decorativo a mais. Sem o selo/animação
 * de carimbo — esse gesto já é usado na landing (ver CLAUDE.md >
 * Identidade visual, "reservar para um único lugar por tela").
 *
 * Todo número vem de `view`, calculado uma única vez pelo motor
 * (`lib/quotes/engine.ts`). Esta tela não soma nada — é o que garante que a
 * prévia e o documento emitido nunca divirjam.
 */
export function QuotePdfPreview({
  number,
  revision,
  customerName,
  customerDocument,
  view,
  discount,
  paymentConditionLabel,
  footerNote = null,
  showTaxLines = true,
  issued = false,
}: {
  /** Nulo enquanto o orçamento não foi salvo — a numeração é alocada pelo banco. */
  number: string | null;
  revision: number;
  customerName: string | null;
  customerDocument: string | null;
  view: QuoteView;
  discount: QuoteDiscount;
  paymentConditionLabel: string | null;
  footerNote?: string | null;
  /** `tax_settings.show_tax_lines` — controla a linha de destaque, não o rodapé. */
  showTaxLines?: boolean;
  issued?: boolean;
}) {
  return (
    <div className="perforated-top bg-card text-card-foreground ring-foreground/10 relative w-full rounded-lg pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.25)] ring-1">
      <div className="flex items-start justify-between px-5">
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
            Orçamento{revision > 1 ? ` — revisão ${revision}` : ""}
          </p>
          <p className="font-mono text-lg font-medium tabular-nums">
            {number ? `Nº ${number}` : "Nº a definir"}
          </p>
        </div>
        <span className="border-border text-muted-foreground rounded-full border px-2.5 py-1 text-[0.65rem] font-medium tracking-wide uppercase">
          {issued ? "Emitido" : "Prévia"}
        </span>
      </div>

      <div className="text-muted-foreground flex flex-col gap-0.5 px-5 pt-3 text-sm">
        <span className="text-foreground font-medium">
          {customerName ?? "Cliente não selecionado"}
        </span>
        {customerDocument ? <span className="tabular-nums">{customerDocument}</span> : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-y px-5 py-4">
        {view.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum item adicionado ainda.</p>
        ) : (
          view.items.map((item) => (
            <div key={item.position} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {item.quantity}x
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {currencyFormatter.format(item.lineTotal)}
                </span>
              </div>
              {/*
                Unitário exibido é a BASE, não o preço de catálogo, quando há
                tributo `inclusive` (briefing §7.2) — só aparece quando difere
                do preço de catálogo, para não repetir o mesmo número num
                orçamento sem imposto embutido.
              */}
              {item.unitBaseDisplay !== item.unitPrice ? (
                <p className="text-muted-foreground pl-3 text-xs">
                  unitário {currencyFormatter.format(item.unitBaseDisplay)}
                </p>
              ) : null}
              {showTaxLines
                ? item.taxes.map((tax) => (
                    <div
                      key={tax.code}
                      className="text-muted-foreground flex items-baseline justify-between gap-3 pl-3 text-xs"
                    >
                      <span className="truncate">
                        {tax.label} ({tax.rate}%
                        {tax.mode === "inclusive"
                          ? " — já incluso no valor acima"
                          : " — somado ao total"}
                        {tax.note ? ` — ${tax.note}` : ""})
                      </span>
                      <span className="font-mono tabular-nums">
                        {currencyFormatter.format(tax.amount)}
                      </span>
                    </div>
                  ))
                : null}
            </div>
          ))
        )}

        {view.discountAmount > 0 ? (
          <div className="text-danger flex items-baseline justify-between gap-3 text-sm">
            <span>
              Desconto negociado{discount.type === "percent" ? ` (${discount.value}%)` : ""}
            </span>
            <span className="font-mono tabular-nums">
              −{currencyFormatter.format(view.discountAmount)}
            </span>
          </div>
        ) : null}

        {view.paymentDiscountAmount > 0 ? (
          <div className="text-danger flex items-baseline justify-between gap-3 text-sm">
            <span>Desconto da condição de pagamento</span>
            <span className="font-mono tabular-nums">
              −{currencyFormatter.format(view.paymentDiscountAmount)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between px-5 py-4">
        <span className="text-sm font-medium">Total</span>
        <span className="font-mono text-xl font-semibold tabular-nums">
          {currencyFormatter.format(view.total)}
        </span>
      </div>

      <div className="text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-[0.65rem]">
        <span>{paymentConditionLabel ?? "Condição de pagamento não definida"}</span>
        <span className="font-mono">PDF ↗</span>
      </div>

      {/*
        Rodapé da Lei 12.741/2012: TEXTO configurado pela organização, copiado
        para `quotes.tax_footer_note` na emissão. O V1 não estima percentual e
        não interpola valor nenhum aqui (briefing §8).
      */}
      {footerNote ? (
        <p className="text-muted-foreground border-t px-5 py-3 text-[0.65rem] leading-relaxed">
          {footerNote}
        </p>
      ) : null}
    </div>
  );
}
