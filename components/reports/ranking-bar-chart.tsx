import { EmptyState } from "@/components/states/empty-state";

/** Barras horizontais categóricas — mesmo estilo de sales-funnel-chart.tsx, generalizado para qualquer rótulo/valor. */
export function RankingBarChart({
  rows,
  valueFormatter,
  emptyTitle,
  emptyDescription,
}: {
  rows: { key: string; label: string; value: number }[];
  valueFormatter: (value: number) => string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <span className="text-muted-foreground w-32 shrink-0 truncate text-xs" title={row.label}>
            {row.label}
          </span>
          <div className="bg-muted h-6 flex-1 overflow-hidden rounded-sm">
            <div
              className="bg-primary flex h-full items-center justify-end rounded-sm px-2 transition-[width]"
              style={{ width: `${(row.value / maxValue) * 100}%` }}
            >
              <span className="text-primary-foreground text-xs font-medium tabular-nums">
                {valueFormatter(row.value)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
