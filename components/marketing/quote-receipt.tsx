const lineItems = [
  { label: "Consultoria de implantação", qty: "1x", value: "1.200,00" },
  { label: "Licença mensal — plano Time", qty: "1x", value: "149,00" },
  { label: "ICMS (12%, por fora)", qty: "—", value: "161,88" },
];

export function QuoteReceipt() {
  return (
    <div className="perforated-top bg-card text-card-foreground ring-foreground/10 relative w-full max-w-sm rounded-lg pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.25)] ring-1">
      <div className="flex items-start justify-between px-5">
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-[0.14em] uppercase">
            Orçamento
          </p>
          <p className="font-mono text-lg font-medium tabular-nums">Nº 000482</p>
        </div>
        <div
          className="stamp-seal border-primary text-primary flex flex-col items-center justify-center rounded-full border-2 px-3 py-2 text-center leading-none"
          aria-hidden="true"
        >
          <span className="text-[0.6rem] font-bold tracking-[0.08em]">PRONTO</span>
          <span className="mt-0.5 font-mono text-[0.55rem] tracking-widest">00:04s</span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-y px-5 py-4">
        {lineItems.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs">{item.qty}</span>
            <span className="shrink-0 font-mono text-sm tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between px-5 py-4">
        <span className="text-sm font-medium">Total</span>
        <span className="font-mono text-xl font-semibold tabular-nums">R$ 1.510,88</span>
      </div>

      <div className="text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-[0.65rem]">
        <span>ICMS por fora — alíquota da categoria, condição à vista</span>
        <span className="font-mono">PDF ↗</span>
      </div>
    </div>
  );
}
