/**
 * As duas únicas cores não-semânticas do design system (`chart-1` é o
 * accent "tinta de carimbo", `chart-5` é o neutro) — `chart-2/3/4`
 * são reservadas a verde/âmbar/vermelho (convertido/expirando/expirado)
 * e não podem ser reaproveitadas aqui (ver CLAUDE.md > Identidade visual).
 * Nova origem além de Site/CRM cai no neutro até o design system ganhar
 * um terceiro tom categórico.
 */
export const sourceAccentClass: Record<string, string> = {
  site: "bg-chart-1",
  crm: "bg-chart-5",
};

export function getSourceAccentClass(sourceId: string): string {
  return sourceAccentClass[sourceId] ?? "bg-chart-5";
}

/** Mesma paleta acima, em valor de CSS var — para `ChartConfig.color`/`fill` do Recharts, que não aceita classe Tailwind. */
export const sourceChartColorVar: Record<string, string> = {
  site: "var(--chart-1)",
  crm: "var(--chart-5)",
};

export function getSourceChartColorVar(sourceId: string): string {
  return sourceChartColorVar[sourceId] ?? "var(--chart-5)";
}
