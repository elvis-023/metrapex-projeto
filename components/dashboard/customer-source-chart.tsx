import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { getCustomerSource } from "@/lib/customers/mock-data";
import { getSourceAccentClass } from "@/lib/customers/source-colors";
import { formatRate } from "@/lib/dashboard/format";
import type { SourceBreakdown } from "@/lib/dashboard/types";

export function CustomerSourceChart({ breakdown }: { breakdown: SourceBreakdown[] }) {
  const total = breakdown.reduce((sum, entry) => sum + entry.count, 0);
  const maxCount = Math.max(...breakdown.map((entry) => entry.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem dos clientes</CardTitle>
        <CardDescription>De onde vieram os orçamentos gerados no período</CardDescription>
      </CardHeader>
      <CardContent className={total === 0 ? undefined : "flex flex-col gap-3"}>
        {total === 0 ? (
          <EmptyState
            title="Nenhum orçamento no período"
            description="Ainda não há orçamentos gerados para calcular a origem dos clientes."
          />
        ) : (
          <>
            <div className="flex items-center gap-4">
              {breakdown.map((entry) => {
                const source = getCustomerSource(entry.sourceId);
                return (
                  <div key={entry.sourceId} className="flex items-center gap-1.5">
                    <span
                      className={`size-2 shrink-0 rounded-full ${getSourceAccentClass(entry.sourceId)}`}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground text-xs">{source.name}</span>
                  </div>
                );
              })}
            </div>

            {breakdown.map((entry) => {
              const source = getCustomerSource(entry.sourceId);
              return (
                <div key={entry.sourceId} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-16 shrink-0 text-xs">{source.name}</span>
                  <div className="bg-muted h-6 flex-1 overflow-hidden rounded-sm">
                    <div
                      className={`h-full ${getSourceAccentClass(entry.sourceId)} flex items-center justify-end rounded-sm px-2 transition-[width]`}
                      style={{ width: `${(entry.count / maxCount) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white tabular-nums">
                        {entry.count}
                      </span>
                    </div>
                  </div>
                  <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
                    {formatRate(entry.count / total)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
