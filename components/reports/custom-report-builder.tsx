"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RankingBarChart } from "@/components/reports/ranking-bar-chart";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/states/empty-state";
import { fakeCustomerSources } from "@/lib/customers/mock-data";
import { runCustomReportAction } from "@/lib/reports/actions";
import { countFormatter, currencyFormatter } from "@/lib/reports/format";
import {
  customGroupByOptionsByObject,
  customMetricOptions,
  customNumericMetricAllowed,
  customObjectOptions,
  reportPeriodOptions,
  resolveReportFilters,
  validateCustomReportSpec,
  type CustomGroupBy,
  type CustomMetric,
  type CustomObject,
  type CustomReportResult,
  type CustomReportSpec,
  type ReportPeriod,
} from "@/lib/reports/types";

const ALL_VALUE = "__all__";

export function CustomReportBuilder({ sellers }: { sellers: { id: string; name: string }[] }) {
  const [object, setObject] = useState<CustomObject>("quotes");
  const [metric, setMetric] = useState<CustomMetric>("count");
  const [groupBy, setGroupBy] = useState<CustomGroupBy>("status");
  const [period, setPeriod] = useState<ReportPeriod>("90d");
  const [ownerId, setOwnerId] = useState<string>(ALL_VALUE);
  const [sourceId, setSourceId] = useState<string>(ALL_VALUE);
  const [result, setResult] = useState<CustomReportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleObjectChange(value: CustomObject | null) {
    if (!value) return;
    setObject(value);
    setGroupBy(customGroupByOptionsByObject[value][0].value);
    if (!customNumericMetricAllowed[value]) setMetric("count");
    setResult(null);
  }

  function buildSpec(): CustomReportSpec {
    const filters = resolveReportFilters(period);
    return {
      object,
      metric,
      groupBy,
      filters: {
        ...filters,
        ownerId: ownerId === ALL_VALUE ? undefined : ownerId,
        sourceId: sourceId === ALL_VALUE ? undefined : sourceId,
      },
    };
  }

  function handleGenerate() {
    const spec = buildSpec();
    const validationError = validateCustomReportSpec(spec);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    startTransition(async () => {
      try {
        const data = await runCustomReportAction(spec);
        setResult(data);
      } catch {
        toast.error("Não foi possível gerar o relatório.");
      }
    });
  }

  const groupByOptions = customGroupByOptionsByObject[object];
  const spec = buildSpec();
  const valueFormatter = (value: number) =>
    metric === "count" ? countFormatter.format(value) : currencyFormatter.format(value);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatório customizável</CardTitle>
          <CardDescription>Escolha objeto, métrica, agrupamento e filtro.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Objeto</label>
              <Select value={object} onValueChange={handleObjectChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      customObjectOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customObjectOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Métrica</label>
              <Select
                value={metric}
                onValueChange={(value) => value && setMetric(value as CustomMetric)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      customMetricOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customMetricOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.value !== "count" && !customNumericMetricAllowed[object]}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Agrupamento</label>
              <Select
                value={groupBy}
                onValueChange={(value) => value && setGroupBy(value as CustomGroupBy)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      groupByOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groupByOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Período</label>
              <Select
                value={period}
                onValueChange={(value) => value && setPeriod(value as ReportPeriod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      reportPeriodOptions.find((option) => option.value === value)?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {reportPeriodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {object !== "customers" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Vendedor</label>
                <Select value={ownerId} onValueChange={(value) => value && setOwnerId(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === ALL_VALUE
                          ? "Todos"
                          : (sellers.find((seller) => seller.id === value)?.name ?? "Todos")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                    {sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {object !== "customers" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Origem</label>
                <Select value={sourceId} onValueChange={(value) => value && setSourceId(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === ALL_VALUE
                          ? "Todas"
                          : (fakeCustomerSources.find((source) => source.id === value)?.name ??
                            "Todas")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                    {fakeCustomerSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div>
            <Button onClick={handleGenerate} disabled={isPending}>
              {isPending ? "Gerando..." : "Gerar relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <ReportCard
          title="Resultado"
          description={`${result.metricLabel} — agrupado por ${groupByOptions.find((option) => option.value === groupBy)?.label.toLowerCase()}`}
          exportObject={object}
          filters={spec.filters}
        >
          {result.groups.length === 0 ? (
            <EmptyState
              title="Nenhum dado no período"
              description="Ajuste o período ou os filtros e gere de novo."
            />
          ) : (
            <RankingBarChart
              rows={result.groups}
              valueFormatter={valueFormatter}
              emptyTitle="Nenhum dado no período"
              emptyDescription="Ajuste o período ou os filtros e gere de novo."
            />
          )}
        </ReportCard>
      ) : null}
    </div>
  );
}
