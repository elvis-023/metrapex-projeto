import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type { Product } from "@/lib/catalog/types";
import type { PublicOrganization } from "@/lib/public-form/types";

/**
 * Client de service_role isolado a esta página. Não é exportado de
 * `lib/supabase/` de propósito — a resolução do formulário público não passa
 * por sessão/RLS (não existe usuário logado aqui), então este client
 * bypassa RLS inteiramente. Mantê-lo só neste arquivo evita que outra rota
 * o importe por engano e reuse esse poder fora deste contexto.
 */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role não configurado.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type ResolvedPublicForm = {
  organization: PublicOrganization;
  products: Product[];
};

/**
 * Resolve organização e catálogo pela chave pública do snippet
 * (`organizations.public_form_key`) — nunca pelo `slug` interno (ver
 * migration 20260726000010: chave dedicada, rotacionável, não é segredo).
 * Devolve `null` se a chave não existir — a página trata como 404.
 */
export const resolvePublicForm = cache(async function resolvePublicForm(
  publicFormKey: string,
): Promise<ResolvedPublicForm | null> {
  const supabase = createServiceClient();

  const { data: org } = await supabase
    .rpc("resolve_public_organization", { p_public_form_key: publicFormKey })
    .maybeSingle();

  if (!org) return null;

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, external_code, name, price, stock, category_id, photo_url, alternative_title, catalog_url, manual_url, video_url, certificate_eligible, lead_time",
    )
    .eq("org_id", org.id)
    .order("name");

  return {
    organization: {
      slug: org.slug,
      name: org.name,
      logoInitial: org.name.charAt(0).toUpperCase(),
      supportEmail: "",
    },
    products: (products ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_code,
      name: row.name,
      price: Number(row.price),
      stock: row.stock,
      categoryId: row.category_id,
      photoUrl: row.photo_url,
      alternativeTitle: row.alternative_title,
      catalogUrl: row.catalog_url,
      manualUrl: row.manual_url,
      videoUrl: row.video_url,
      certificateEligible: row.certificate_eligible,
      leadTime: row.lead_time,
    })),
  };
});
