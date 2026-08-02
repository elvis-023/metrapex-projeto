"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/states/empty-state";
import { formatChartValue, type ChartValueFormat } from "@/lib/reports/format";

const chartConfig = {
  value: { label: "Valor", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Barra vira alta o bastante pra caber o rótulo sem espremer; acima de 20 linhas, o card ganha um teto e rola por dentro em vez de esticar a página indefinidamente. */
const ROW_HEIGHT_PX = 32;
const MIN_HEIGHT_PX = 160;
const VISIBLE_ROWS_CAP = 20;

/**
 * Bar Chart — Horizontal (ui.shadcn.com/charts): ranking simples, série
 * única, sem segunda série pra comparar. Genérico de propósito — usado tal
 * qual nos dois rankings fixos (produtos mais orçados/convertidos, sempre
 * ≤10 linhas) e reaproveitado no relatório customizável
 * (`custom-report-builder.tsx`), onde o rótulo da dimensão e a quantidade de
 * linhas são escolhidos pelo usuário em tempo real — nem o `ChartConfig`
 * (uma entrada só, `value`) nem o eixo de categoria (lê `label` direto da
 * linha) dependem de saber qual dimensão foi escolhida.
 */
export function RankingBarChart({
  rows,
  valueFormat,
  emptyTitle,
  emptyDescription,
}: {
  rows: { key: string; label: string; value: number }[];
  valueFormat: ChartValueFormat;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const valueFormatter = (value: number) => formatChartValue(valueFormat, value);

  const chartHeight = Math.max(MIN_HEIGHT_PX, rows.length * ROW_HEIGHT_PX);
  const needsScroll = rows.length > VISIBLE_ROWS_CAP;

  const chart = (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto w-full"
      style={{ height: chartHeight }}
    >
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 48 }}>
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={140}
          tickMargin={8}
          interval={0}
        />
        <XAxis dataKey="value" type="number" hide />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value) => (
                <span className="text-foreground font-mono font-medium tabular-nums">
                  {valueFormatter(Number(value))}
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={4}
          animationDuration={600}
          animationEasing="ease-out"
        >
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground text-xs tabular-nums"
            formatter={(value) => valueFormatter(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );

  if (!needsScroll) {
    return chart;
  }

  return (
    <div
      className="overflow-y-auto"
      style={{ maxHeight: MIN_HEIGHT_PX + VISIBLE_ROWS_CAP * ROW_HEIGHT_PX }}
    >
      {chart}
    </div>
  );
}
