import { EmptyState } from "@/components/states/empty-state";
import { formatRate } from "@/lib/reports/format";
import type { GroupedReportRow } from "@/lib/reports/types";

/** Total x convertido por grupo (vendedor/origem/faixa) — barra cheia = total, faixa preenchida = convertido. */
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

  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <span className="text-muted-foreground w-32 shrink-0 truncate text-xs" title={row.label}>
            {row.label}
          </span>
          <div className="bg-muted relative h-6 flex-1 overflow-hidden rounded-sm">
            <div
              className="bg-muted-foreground/30 absolute inset-y-0 left-0 rounded-sm transition-[width]"
              style={{ width: `${(row.total / maxTotal) * 100}%` }}
            />
            <div
              className="bg-primary absolute inset-y-0 left-0 flex items-center justify-end rounded-sm px-2 transition-[width]"
              style={{ width: `${(row.converted / maxTotal) * 100}%` }}
            >
              {row.converted > 0 ? (
                <span className="text-primary-foreground text-xs font-medium tabular-nums">
                  {row.converted}
                </span>
              ) : null}
            </div>
          </div>
          <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
            {row.total} · {formatRate(row.rate)}
          </span>
        </div>
      ))}
    </div>
  );
}
