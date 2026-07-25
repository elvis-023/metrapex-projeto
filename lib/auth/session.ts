import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/supabase/types";

export const PROTECTED_PATHS = [
  "/dashboard",
  "/catalog",
  "/customers",
  "/pipeline",
  "/quotes",
  "/settings",
  "/onboarding",
] as const;

export const AUTH_ONLY_PATHS = ["/login", "/signup"] as const;

export const CURRENT_ORG_COOKIE = "current_org_id";

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
};

export type SessionUser = { name: string; email: string; initials: string };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase() ||
    "U"
  );
}

/** Perfil do usuário da sessão atual, ou null. */
export async function getCurrentUserProfile(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name || user.email || "Usuário";
  const email = profile?.email ?? user.email ?? "";
  return { name, email, initials: initialsOf(name) };
}

/** Usuário autenticado da sessão atual, ou null. Sempre valida contra o Supabase Auth. */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Todas as organizações às quais o usuário da sessão pertence, com o papel em cada uma. */
export async function getUserOrganizations(): Promise<SessionOrganization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug, plan)")
    .returns<
      { role: OrgRole; organizations: { id: string; name: string; slug: string; plan: string } }[]
    >();

  if (error || !data) return [];

  return data
    .filter((row) => row.organizations)
    .map((row) => ({
      id: row.organizations.id,
      name: row.organizations.name,
      slug: row.organizations.slug,
      plan: row.organizations.plan,
      role: row.role,
    }));
}

/**
 * Organização "atual" da sessão: lê o cookie de preferência do dropdown, mas
 * SEMPRE valida contra as organizações reais do usuário — o cookie nunca é
 * fonte de verdade de autorização, só um hint de qual escolher.
 */
export async function getCurrentOrganization(): Promise<SessionOrganization | null> {
  const orgs = await getUserOrganizations();
  if (orgs.length === 0) return null;

  const jar = await cookies();
  const preferredId = jar.get(CURRENT_ORG_COOKIE)?.value;

  return orgs.find((org) => org.id === preferredId) ?? orgs[0];
}
