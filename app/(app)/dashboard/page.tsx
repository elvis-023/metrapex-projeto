import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SalesFunnelChart } from "@/components/dashboard/sales-funnel-chart";
import { ExpiringQuotesTable } from "@/components/dashboard/expiring-quotes-table";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import {
  getDashboardMetrics,
  dashboardPeriodOptions,
  type DashboardPeriod,
} from "@/lib/dashboard/mock-data";

function resolvePeriod(value: string | undefined): DashboardPeriod {
  return dashboardPeriodOptions.some((option) => option.value === value)
    ? (value as DashboardPeriod)
    : "30d";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = resolvePeriod((await searchParams).period);
  const metrics = await getDashboardMetrics(period);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <PeriodFilter period={period} />
      </div>

      <KpiCards metrics={metrics} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesFunnelChart funnel={metrics.funnel} />
        <ExpiringQuotesTable quotes={metrics.expiringQuotes} />
      </div>
    </div>
  );
}
