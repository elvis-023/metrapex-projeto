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
