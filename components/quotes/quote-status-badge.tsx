import { Badge } from "@/components/ui/badge";
import type { FakeQuoteStatus } from "@/lib/mock-data";

const statusConfig: Record<
  FakeQuoteStatus,
  { label: string; variant: "secondary" | "success" | "warning" | "danger" }
> = {
  gerado: { label: "Gerado", variant: "secondary" },
  enviado: { label: "Enviado", variant: "secondary" },
  negociacao: { label: "Em negociação", variant: "warning" },
  convertido: { label: "Convertido", variant: "success" },
  expirado: { label: "Expirado", variant: "danger" },
};

export function QuoteStatusBadge({ status }: { status: FakeQuoteStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
