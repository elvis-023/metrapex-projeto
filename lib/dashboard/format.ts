export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const countFormatter = new Intl.NumberFormat("pt-BR");

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * `new Date("2026-07-25")` parseia como meia-noite UTC — em fuso
 * negativo (America/Sao_Paulo) isso exibe o dia anterior. Datas sem
 * horário (`expiresAt`) devem sempre passar por aqui antes de
 * `dateFormatter`/`timelineFormatter`, nunca por `new Date(string)` direto.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** `rate` é uma fração (0.31 -> "31%"). */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 }).format(
    rate,
  );
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

/** Variação percentual entre dois valores absolutos, ex. `+18%`. */
export function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "+100%";
  const change = Math.round(((current - previous) / previous) * 100);
  const sign = change > 0 ? "+" : "";
  return `${sign}${change}%`;
}

/** Diferença em pontos percentuais entre duas frações, ex. `+4pp`. */
export function formatPercentPointsChange(currentRate: number, previousRate: number): string {
  const points = Math.round((currentRate - previousRate) * 100);
  const sign = points > 0 ? "+" : "";
  return `${sign}${points}pp`;
}
