import type { Metadata } from "next";

import { ConversionBarChart } from "@/components/reports/conversion-bar-chart";
import { RankingBarChart } from "@/components/reports/ranking-bar-chart";
import { ReportCard } from "@/components/reports/report-card";
import { ReportPeriodFilter } from "@/components/reports/report-period-filter";
import { TrendBarChart } from "@/components/reports/trend-bar-chart";
import { EmptyState } from "@/components/states/empty-state";
import {
  currencyFormatter,
  countFormatter,
  formatDuration,
  formatRate,
} from "@/lib/reports/format";
import { getPrebuiltReportsData } from "@/lib/reports/queries";
import { reportPeriodOptions, resolveReportFilters, type ReportPeriod } from "@/lib/reports/types";

export const metadata: Metadata = { title: "Relatórios" };

function resolvePeriod(value: string | undefined): ReportPeriod {
  return reportPeriodOptions.some((option) => option.value === value)
    ? (value as ReportPeriod)
    : "90d";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = resolvePeriod((await searchParams).period);
  const filters = resolveReportFilters(period);
  const data = await getPrebuiltReportsData(period);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <ReportPeriodFilter period={period} basePath="/reports" />
      </div>

      <ReportCard
        title="Orçamentos por período"
        description="Volume de orçamentos gerados no período, agrupado por dia, semana ou mês."
        exportObject="quotes"
        filters={filters}
      >
        <TrendBarChart
          points={data.quotesByPeriod}
          valueFormatter={(value) => countFormatter.format(value)}
          emptyTitle="Nenhum orçamento no período"
          emptyDescription="Ainda não há orçamentos gerados nesta janela."
        />
      </ReportCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard
          title="Conversão por vendedor"
          description="Taxa de conversão de cada vendedor no período."
          exportObject="quotes"
          filters={filters}
        >
          <ConversionBarChart
            rows={data.conversionBySeller}
            emptyTitle="Sem orçamentos atribuídos"
            emptyDescription="Nenhum orçamento do período tem vendedor responsável."
          />
        </ReportCard>

        <ReportCard
          title="Conversão por origem"
          description="Taxa de conversão por origem do cliente (Site, CRM)."
          exportObject="quotes"
          filters={filters}
        >
          <ConversionBarChart
            rows={data.conversionBySource}
            emptyTitle="Nenhum orçamento no período"
            emptyDescription="Ainda não há orçamentos gerados nesta janela."
          />
        </ReportCard>
      </div>

      <ReportCard
        title="Conversão por faixa de valor"
        description="Taxa de conversão por faixa de valor do orçamento emitido."
        exportObject="quotes"
        filters={filters}
      >
        <ConversionBarChart
          rows={data.conversionByBand}
          emptyTitle="Nenhum orçamento emitido no período"
          emptyDescription="Faixa de valor só existe em orçamento já emitido — rascunho não conta."
        />
      </ReportCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard
          title="Ticket médio"
          description="Valor médio dos orçamentos emitidos, com evolução no período."
          exportObject="quotes"
          filters={filters}
        >
          <div className="flex flex-col gap-4">
            <p className="text-2xl font-medium tabular-nums">
              {currencyFormatter.format(data.averageTicket.overall)}
            </p>
            <TrendBarChart
              points={data.averageTicket.trend}
              valueFormatter={(value) => currencyFormatter.format(value)}
              emptyTitle="Nenhum orçamento emitido no período"
              emptyDescription="Ticket médio só considera orçamento já emitido."
            />
          </div>
        </ReportCard>

        <ReportCard
          title="Taxa de expiração"
          description="Proporção de orçamentos que venceram sem conversão."
          exportObject="quotes"
          filters={filters}
        >
          <div className="flex flex-col gap-4">
            <p className="text-2xl font-medium tabular-nums">
              {formatRate(data.expirationRate.overall)}
            </p>
            <TrendBarChart
              points={data.expirationRate.trend}
              valueFormatter={(value) => formatRate(value)}
              emptyTitle="Nenhum orçamento no período"
              emptyDescription="Ainda não há orçamentos gerados nesta janela."
            />
          </div>
        </ReportCard>
      </div>

      <ReportCard
        title="Produtos mais orçados e mais convertidos"
        description="Ranking de produtos por quantidade de orçamentos e por orçamento convertido — só orçamento emitido."
        exportObject="quote_items"
        filters={filters}
      >
        {data.topProducts.mostQuoted.length === 0 ? (
          <EmptyState
            title="Nenhum item orçado no período"
            description="Ainda não há orçamento emitido com itens nesta janela."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-medium">Mais orçados</p>
              <RankingBarChart
                rows={data.topProducts.mostQuoted.map((product) => ({
                  key: product.productId ?? product.productExternalCode,
                  label: product.productName,
                  value: product.quotedCount,
                }))}
                valueFormatter={(value) => countFormatter.format(value)}
                emptyTitle="Nenhum item orçado no período"
                emptyDescription="Ainda não há orçamento emitido com itens nesta janela."
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-medium">Mais convertidos</p>
              <RankingBarChart
                rows={data.topProducts.mostConverted.map((product) => ({
                  key: product.productId ?? product.productExternalCode,
                  label: product.productName,
                  value: product.convertedCount,
                }))}
                valueFormatter={(value) => countFormatter.format(value)}
                emptyTitle="Nenhum produto convertido no período"
                emptyDescription="Nenhum orçamento com este produto foi convertido ainda."
              />
            </div>
          </div>
        )}
      </ReportCard>

      <ReportCard
        title="Evolução do tempo até o primeiro orçamento"
        description="KPI central do produto — do pedido do cliente ao PDF, evolução histórica no período."
        exportObject="quotes"
        filters={filters}
      >
        <div className="flex flex-col gap-4">
          <p className="text-2xl font-medium tabular-nums">
            {formatDuration(data.timeToFirstQuote.overallSeconds)}
          </p>
          <TrendBarChart
            points={data.timeToFirstQuote.trend}
            valueFormatter={(value) => formatDuration(value)}
            emptyTitle="Nenhum orçamento do formulário público no período"
            emptyDescription="O KPI só considera orçamento gerado pelo formulário público (origem Site)."
          />
        </div>
      </ReportCard>
    </div>
  );
}
