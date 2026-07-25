import { KanbanBoard } from "@/components/kanban/kanban-board";
import { fakeSalespeople } from "@/lib/pipeline/mock-data";

export default function PipelinePage() {
  return <KanbanBoard salespeople={fakeSalespeople} />;
}
