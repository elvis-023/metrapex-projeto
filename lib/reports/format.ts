import type { BucketUnit } from "@/lib/reports/types";

import {
  currencyFormatter,
  countFormatter,
  formatRate,
  formatDuration,
} from "@/lib/dashboard/format";

export { currencyFormatter, countFormatter, formatRate, formatDuration };

/**
 * As páginas de relatório que montam `<TrendBarChart>`/`<RankingBarChart>`
 * são Server Component (`app/(app)/reports/page.tsx`) — não dá para passar
 * uma função de formatação como prop pra um componente `"use client"`
 * (Recharts exige client), o RSC rejeita função não-serializável cruzando
 * essa fronteira. Por isso o formatador vai como identificador plano
 * (`ChartValueFormat`), resolvido aqui dentro do componente client, nunca
 * como closure vinda de fora.
 */
export type ChartValueFormat = "count" | "currency" | "rate" | "duration";

export function formatChartValue(format: ChartValueFormat, value: number): string {
  switch (format) {
    case "count":
      return countFormatter.format(value);
    case "currency":
      return currencyFormatter.format(value);
    case "rate":
      return formatRate(value);
    case "duration":
      return formatDuration(value);
  }
}

/**
 * Quantidade em pt-BR (vírgula decimal) — colunas de export que ficam sem
 * aspas no CSV (vírgula não é o delimitador, `;` é) precisam do valor JÁ em
 * texto pt-BR: um `number` bruto serializa com PONTO ("2.5"), e o Excel
 * brasileiro lê esse ponto como separador de milhar, não decimal — o campo
 * vira TEXTO em vez de número (achado ao abrir a exportação de verdade no
 * Excel pt-BR). `quantity` é `numeric(18,6)` no banco — 6 casas cobre o pior caso.
 */
export const quantityFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });

// `timeZone: "UTC"` nos dois — sem isso, o formatador usa o fuso local de
// quem está rodando (navegador/servidor) sobre uma data construída em UTC
// (Date.UTC abaixo), e um fuso negativo (America/Sao_Paulo) mostra o dia/mês
// anterior perto da virada. A chave já é UTC (bucketKey) — o rótulo precisa
// respeitar a mesma convenção, não a do relógio de quem está vendo a tela.
const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/**
 * Chave de bucket derivada de uma data — dia (`YYYY-MM-DD`), semana (data de
 * segunda-feira daquela semana, mesmo formato) ou mês (`YYYY-MM`).
 * Sempre em UTC: os timestamps do banco (`created_at`) já são UTC, e bucketar
 * em horário local moveria orçamentos de fuso perto da meia-noite para o
 * bucket errado dependendo do fuso de quem está vendo o relatório.
 */
export function bucketKey(date: Date, unit: BucketUnit): string {
  if (unit === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (unit === "week") {
    const day = date.getUTCDay();
    // Segunda-feira da semana (dia 1); domingo (0) volta 6 dias, não 1.
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diffToMonday),
    );
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export function bucketLabel(key: string, unit: BucketUnit): string {
  if (unit === "month") {
    const [year, month] = key.split("-").map(Number);
    return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  }
  // Dia e semana usam a mesma chave "YYYY-MM-DD" (semana = segunda-feira).
  const [year, month, day] = key.split("-").map(Number);
  return dayLabelFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}
