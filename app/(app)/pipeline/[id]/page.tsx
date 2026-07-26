import { notFound } from "next/navigation";

import { QuoteDetail } from "@/components/kanban/quote-detail";
import { createClient } from "@/lib/supabase/server";
import { getQuoteById } from "@/lib/quotes/queries";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  if (!quote) notFound();

  let ownerName: string | null = null;
  if (quote.ownerId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", quote.ownerId)
      .maybeSingle();
    ownerName = data?.full_name ?? null;
  }

  return <QuoteDetail quote={quote} ownerName={ownerName} />;
}
