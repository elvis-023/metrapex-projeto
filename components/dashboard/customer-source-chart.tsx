"use client";

import { Label, Pie, PieChart } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/states/empty-state";
import { getCustomerSource } from "@/lib/customers/mock-data";
import { getSourceChartColorVar } from "@/lib/customers/source-colors";
import { countFormatter, formatRate } from "@/lib/dashboard/format";
import type { SourceBreakdown } from "@/lib/dashboard/types";

/**
 * Pie Chart — Donut with Text (ui.shadcn.com/charts): é proporção do total,
 * não série ao longo de categoria/tempo — o donut com o total no centro lê
 * melhor essa relação "parte de um todo" do que uma barra, e a legenda
 * embaixo preserva nome + cor que a versão anterior já mostrava.
 */
export function CustomerSourceChart({ breakdown }: { breakdown: SourceBreakdown[] }) {
  const total = breakdown.reduce((sum, entry) => sum + entry.count, 0);

  const chartConfig = Object.fromEntries(
    breakdown.map((entry) => [
      entry.sourceId,
      {
        label: getCustomerSource(entry.sourceId).name,
        color: getSourceChartColorVar(entry.sourceId),
      },
    ]),
  ) satisfies ChartConfig;

  const chartData = breakdown.map((entry) => ({
    sourceId: entry.sourceId,
    name: getCustomerSource(entry.sourceId).name,
    count: entry.count,
    fill: `var(--color-${entry.sourceId})`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem dos clientes</CardTitle>
        <CardDescription>De onde vieram os orçamentos gerados no período</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            title="Nenhum orçamento no período"
            description="Ainda não há orçamentos gerados para calcular a origem dos clientes."
          />
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-64">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    nameKey="sourceId"
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {chartConfig[item.payload.sourceId]?.label ?? String(name)}
                        </span>
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {countFormatter.format(Number(value))} (
                          {formatRate(Number(value) / total)})
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="sourceId"
                innerRadius={55}
                strokeWidth={4}
                animationDuration={600}
                animationEasing="ease-out"
              >
                <Label
                  content={({ viewBox }) => {
                    if (
                      !viewBox ||
                      !("cx" in viewBox) ||
                      viewBox.cx == null ||
                      viewBox.cy == null
                    ) {
                      return null;
                    }
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground font-mono text-2xl font-semibold tabular-nums"
                        >
                          {countFormatter.format(total)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          orçamentos
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="sourceId" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
