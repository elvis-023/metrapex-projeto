import { Users } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

export default function CustomersPage() {
  return (
    <EmptyState
      icon={Users}
      title="Clientes ainda não têm tela própria"
      description="O cadastro de clientes com deduplicação será construído no Milestone 17."
    />
  );
}
