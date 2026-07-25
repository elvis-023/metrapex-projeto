import { Badge } from "@/components/ui/badge";
import { getCustomerSource } from "@/lib/customers/mock-data";

export function CustomerSourceBadge({ sourceId }: { sourceId: string }) {
  const source = getCustomerSource(sourceId);
  return <Badge variant="outline">{source.name}</Badge>;
}
