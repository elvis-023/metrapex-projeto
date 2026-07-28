import { EmptyState } from "@/components/states/empty-state";
import type { TrendPoint } from "@/lib/reports/types";

/**
 * Colunas verticais ao longo do tempo — até ~30 pontos (30d = diário), então
 * só uma a cada N rótulos aparece por extenso; o restante fica disponível no
 * `title` (tooltip nativo) para não empilhar texto.
 */
export function TrendBarChart({
  points,
  valueFormatter,
  emptyTitle,
  emptyDescription,
}: {
  points: TrendPoint[];
  valueFormatter: (value: number) => string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (points.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const labelStride = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="flex h-40 items-end gap-1">
      {points.map((point, index) => (
        <div
          key={point.bucket}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          title={`${point.label}: ${valueFormatter(point.value)} (${point.count} orçamento${point.count === 1 ? "" : "s"})`}
        >
          <div
            className="bg-primary w-full min-w-[3px] rounded-t-sm transition-[height]"
            style={{ height: `${Math.max(2, (point.value / maxValue) * 100)}%` }}
          />
          <span className="text-muted-foreground w-full truncate text-center text-[10px] tabular-nums">
            {index % labelStride === 0 ? point.label : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
