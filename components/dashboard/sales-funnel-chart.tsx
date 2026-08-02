"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/states/empty-state";
import { countFormatter } from "@/lib/dashboard/format";
import { stageChartColorVar } from "@/lib/pipeline/stage-colors";
import type { FunnelStage } from "@/lib/dashboard/types";

/** Bar Chart — Mixed (ui.shadcn.com/charts): série única, cor por categoria — cada etapa já tinha cor própria fixa, não é uma série de um tom só. */
export function SalesFunnelChart({ funnel }: { funnel: FunnelStage[] }) {
  const total = funnel.reduce((sum, stage) => sum + stage.count, 0);

  const chartConfig = Object.fromEntries(
    funnel.map((stage) => [
      stage.status,
      { label: stage.label, color: stageChartColorVar[stage.status] },
    ]),
  ) satisfies ChartConfig;

  const chartData = funnel.map((stage) => ({
    status: stage.status,
    label: stage.label,
    count: stage.count,
    fill: `var(--color-${stage.status})`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de vendas</CardTitle>
        <CardDescription>Orçamentos por etapa do pipeline no período</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            title="Nenhum orçamento no período"
            description="Ainda não há orçamentos gerados para montar o funil de vendas."
          />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 16 }}
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
              <XAxis
                dataKey="count"
                type="number"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                tickFormatter={(value: number) => countFormatter.format(value)}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)" }}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="count" radius={4} animationDuration={600} animationEasing="ease-out">
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
