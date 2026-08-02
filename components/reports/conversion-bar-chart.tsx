"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/states/empty-state";
import { formatRate } from "@/lib/reports/format";
import type { GroupedReportRow } from "@/lib/reports/types";

const chartConfig = {
  converted: { label: "Convertido", color: "var(--chart-2)" },
  notConverted: { label: "Não convertido", color: "var(--chart-5)" },
} satisfies ChartConfig;

/**
 * Bar Chart — Stacked, horizontal (ui.shadcn.com/charts): convertido +
 * não-convertido somam o total — é literalmente uma proporção de duas
 * partes, não duas séries independentes. A versão anterior simulava isso
 * com duas divs sobrepostas na mesma faixa; stacked é o jeito correto de
 * expressar a mesma relação.
 */
export function ConversionBarChart({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: GroupedReportRow[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const chartData = rows.map((row) => ({
    key: row.key,
    label: row.label,
    converted: row.converted,
    notConverted: row.total - row.converted,
    total: row.total,
    rate: row.rate,
    // Rótulo pré-formatado, não recalculado no `formatter` do LabelList —
    // esse formatter só recebe o valor da célula, sem acesso à linha
    // inteira, então casar `total` de volta pra `rate` por busca seria
    // ambíguo com duas linhas de mesmo total.
    totalLabel: `${row.total} · ${formatRate(row.rate)}`,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto w-full"
      style={{ height: Math.max(160, chartData.length * 40) }}
    >
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{ left: 0, right: 48 }}
      >
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={110}
          tickMargin={8}
        />
        <XAxis dataKey="total" type="number" hide />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelKey="label"
              formatter={(value, name, item, index) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label ?? String(name)}
                  </span>
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    {String(value)}
                    {index === 1 ? ` · ${formatRate(item.payload.rate)}` : ""}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="converted"
          stackId="conversion"
          fill="var(--color-converted)"
          radius={[4, 0, 0, 4]}
          animationDuration={600}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="notConverted"
          stackId="conversion"
          fill="var(--color-notConverted)"
          radius={[0, 4, 4, 0]}
          animationDuration={600}
          animationEasing="ease-out"
        >
          <LabelList
            dataKey="totalLabel"
            position="right"
            className="fill-foreground text-xs tabular-nums"
          />
        </Bar>
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
