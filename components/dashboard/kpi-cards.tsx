import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardMetrics } from "@/lib/dashboard/mock-data";
import {
  countFormatter,
  currencyFormatter,
  formatDuration,
  formatPercentChange,
  formatPercentPointsChange,
  formatRate,
} from "@/lib/dashboard/format";

export function KpiCards({ metrics }: { metrics: DashboardMetrics }) {
  const kpis = [
    {
      label: "Orçamentos no período",
      value: countFormatter.format(metrics.quotesGenerated.count),
      hint: `${formatPercentChange(metrics.quotesGenerated.count, metrics.quotesGenerated.previousCount)} vs. período anterior`,
    },
    {
      label: "Valor em pipeline",
      value: currencyFormatter.format(metrics.pipelineValue.amount),
      hint: `${countFormatter.format(metrics.pipelineValue.openQuotesCount)} orçamentos em aberto`,
    },
    {
      label: "Taxa de conversão",
      value: formatRate(metrics.conversionRate.rate),
      hint: `${formatPercentPointsChange(metrics.conversionRate.rate, metrics.conversionRate.previousRate)} vs. período anterior`,
    },
    {
      label: "Tempo até o 1º orçamento",
      value: formatDuration(metrics.avgTimeToFirstQuoteSeconds),
      hint: "do pedido do cliente ao PDF",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{kpi.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">{kpi.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
