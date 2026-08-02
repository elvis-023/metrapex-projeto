import type { FakeQuoteStatus } from "@/lib/mock-data";

/**
 * Fonte única da cor de cada etapa do pipeline — usada pelo funil do
 * dashboard e pelo Kanban, para as duas visões nunca divergirem.
 * `chart-1` é o mesmo tom que `primary` (accent "tinta de carimbo");
 * `chart-5` é o neutro; negociação/convertido/expirado usam as cores
 * semânticas (âmbar/verde/vermelho) em vez da paleta de marca.
 */
export const stageAccentClass: Record<FakeQuoteStatus, string> = {
  gerado: "bg-chart-5",
  enviado: "bg-chart-1",
  negociacao: "bg-warning",
  convertido: "bg-success",
  expirado: "bg-danger",
};

/** Hover do card do Kanban (Trezofy design scope §05) — mesma cor por estágio do dot acima, como borda + sombra. */
export const stageHoverClass: Record<FakeQuoteStatus, string> = {
  gerado: "hover:border-chart-5 hover:shadow-md hover:shadow-chart-5/25",
  enviado: "hover:border-chart-1 hover:shadow-md hover:shadow-chart-1/25",
  negociacao: "hover:border-warning hover:shadow-md hover:shadow-warning/25",
  convertido: "hover:border-success hover:shadow-md hover:shadow-success/25",
  expirado: "hover:border-danger hover:shadow-md hover:shadow-danger/25",
};

/**
 * Mesma paleta acima, como valor de CSS var em vez de classe Tailwind —
 * `fill`/`ChartConfig.color` do Recharts não aceitam classe, só cor
 * resolvida. `chart-2/3/4` são numericamente idênticos a
 * `success`/`warning`/`danger` (ver app/globals.css) — usar os tokens
 * `chart-N` aqui deixa as 5 etapas na mesma família de variável que o
 * `ChartConfig` do shadcn já espera, sem introduzir uma segunda convenção
 * de cor só para gráfico.
 */
export const stageChartColorVar: Record<FakeQuoteStatus, string> = {
  gerado: "var(--chart-5)",
  enviado: "var(--chart-1)",
  negociacao: "var(--chart-3)",
  convertido: "var(--chart-2)",
  expirado: "var(--chart-4)",
};
