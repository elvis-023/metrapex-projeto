import { notFound } from "next/navigation";

import { QuoteDetail } from "@/components/kanban/quote-detail";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getCurrentOrganization } from "@/lib/auth/session";
import { getQuoteActivities } from "@/lib/pipeline/activities";
import { getQuoteById } from "@/lib/quotes/queries";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, activities, user, org] = await Promise.all([
    getQuoteById(id),
    getQuoteActivities(id),
    getAuthUser(),
    getCurrentOrganization(),
  ]);

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

  // Mesma regra imposta no banco (migration 20260727000011_pipeline_backend.sql):
  // dono do orçamento, admin, ou orçamento ainda sem responsável. Calculada
  // aqui só para decidir o que MOSTRAR (mover card, formulário de nota) — a
  // permissão de verdade é do trigger/RLS, não desta variável.
  const canEdit = !quote.ownerId || quote.ownerId === user?.id || org?.role === "admin";

  return (
    <QuoteDetail quote={quote} ownerName={ownerName} activities={activities} canEdit={canEdit} />
  );
}
