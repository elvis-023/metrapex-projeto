import { Badge } from "@/components/ui/badge";
import type { FakeQuoteStatus } from "@/lib/mock-data";

/**
 * Variantes alinhadas à cor de cada etapa no funil do dashboard
 * (ver `stageAccentClass`): "enviado" usa `default` (bg-primary), que
 * é o mesmo tom de `chart-1` usado na barra do funil.
 */
const statusConfig: Record<
  FakeQuoteStatus,
  { label: string; variant: "secondary" | "default" | "success" | "warning" | "danger" }
> = {
  gerado: { label: "Gerado", variant: "secondary" },
  enviado: { label: "Enviado", variant: "default" },
  negociacao: { label: "Em negociação", variant: "warning" },
  convertido: { label: "Convertido", variant: "success" },
  expirado: { label: "Expirado", variant: "danger" },
};

export function QuoteStatusBadge({ status }: { status: FakeQuoteStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
