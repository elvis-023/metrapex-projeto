import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import type { FunnelStage } from "@/lib/dashboard/mock-data";

const stageColor: Record<FunnelStage["status"], string> = {
  gerado: "bg-chart-5",
  enviado: "bg-chart-1",
  negociacao: "bg-warning",
  convertido: "bg-success",
  expirado: "bg-danger",
};

export function SalesFunnelChart({ funnel }: { funnel: FunnelStage[] }) {
  const total = funnel.reduce((sum, stage) => sum + stage.count, 0);
  const maxCount = Math.max(...funnel.map((stage) => stage.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de vendas</CardTitle>
        <CardDescription>Orçamentos por etapa do pipeline no período</CardDescription>
      </CardHeader>
      <CardContent className={total === 0 ? undefined : "flex flex-col gap-3"}>
        {total === 0 ? (
          <EmptyState
            title="Nenhum orçamento no período"
            description="Ainda não há orçamentos gerados para montar o funil de vendas."
          />
        ) : (
          funnel.map((stage) => (
            <div key={stage.status} className="flex items-center gap-3">
              <span className="text-muted-foreground w-32 shrink-0 text-xs">{stage.label}</span>
              <div className="bg-muted h-6 flex-1 overflow-hidden rounded-sm">
                <div
                  className={`h-full ${stageColor[stage.status]} flex items-center justify-end rounded-sm px-2 transition-[width]`}
                  style={{ width: `${(stage.count / maxCount) * 100}%` }}
                >
                  <span className="text-xs font-medium text-white tabular-nums">{stage.count}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
