import { Kanban } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

export default function PipelinePage() {
  return (
    <EmptyState
      icon={Kanban}
      title="Pipeline chega no Milestone 7"
      description="O board Kanban com as etapas do orçamento será construído aqui."
    />
  );
}
