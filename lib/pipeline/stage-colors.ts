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
