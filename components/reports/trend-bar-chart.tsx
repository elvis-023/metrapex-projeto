"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/states/empty-state";
import { formatChartValue, type ChartValueFormat } from "@/lib/reports/format";
import type { TrendPoint } from "@/lib/reports/types";

const chartConfig = {
  value: { label: "Valor", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Bar Chart (ui.shadcn.com/charts): série única ao longo do tempo, sem
 * segunda série pra comparar — não é a variante "Interactive" (essa é pra
 * alternar entre 2+ séries). O piso de 2% de altura que a versão anterior
 * precisava pra barra baixa não sumir da tela deixa de existir: com eixo Y
 * e grade de verdade, uma barra pequena continua legível pela régua ao
 * lado, não só pela própria altura.
 */
export function TrendBarChart({
  points,
  valueFormat,
  emptyTitle,
  emptyDescription,
}: {
  points: TrendPoint[];
  valueFormat: ChartValueFormat;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (points.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const valueFormatter = (value: number) => formatChartValue(valueFormat, value);

  // Mesmo objetivo do `labelStride` anterior: no máximo ~8 rótulos visíveis
  // no eixo X, pra não empilhar texto em períodos com muitos buckets (30d
  // diário chega a 30 pontos).
  const labelInterval = Math.max(0, Math.ceil(points.length / 8) - 1);

  // "count" é sempre inteiro (nº de orçamentos) — força tick "redondo" nesse
  // caso. Nos outros três, forçar inteiro é o bug que fez o eixo de "Taxa de
  // expiração" mostrar 100/200/300/400% (fração 0–1 arredondada pra inteiro
  // pelo próprio Recharts): esses formatos PRECISAM de tick fracionário.
  const allowDecimals = valueFormat !== "count";
  // Largura fixa de 56px cortava "R$ 26.427,22" no eixo de ticket médio —
  // moeda por extenso precisa de mais espaço que contagem/percentual/duração.
  const yAxisWidth = valueFormat === "currency" ? 96 : 56;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
      <BarChart accessibilityLayer data={points} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={labelInterval}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={yAxisWidth}
          allowDecimals={allowDecimals}
          tickFormatter={(value: number) => valueFormatter(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelKey="label"
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {item.payload.count} orçamento{item.payload.count === 1 ? "" : "s"}
                  </span>
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    {valueFormatter(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[4, 4, 0, 0]}
          animationDuration={600}
          animationEasing="ease-out"
        />
      </BarChart>
    </ChartContainer>
  );
}
