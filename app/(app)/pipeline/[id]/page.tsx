import { QuoteDetail } from "@/components/kanban/quote-detail";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <QuoteDetail id={id} />;
}
