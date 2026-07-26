"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  CURRENT_ORG_COOKIE,
  getCurrentOrganization,
  getUserOrganizations,
} from "@/lib/auth/session";
import { sendInviteEmail } from "@/lib/integrations/resend";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/supabase/types";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${base || "organizacao"}-${suffix}`;
}

/** Troca a organização atual da sessão — o dropdown do topbar chama isto. */
export async function switchOrganizationAction(orgId: string) {
  const orgs = await getUserOrganizations();
  if (!orgs.some((org) => org.id === orgId)) {
    throw new Error("Você não pertence a esta organização.");
  }

  const jar = await cookies();
  jar.set(CURRENT_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

/** Cria a organização do onboarding (Passo 1) e a torna a organização atual. */
export async function createOrganizationAction(
  name: string,
): Promise<{ orgId: string; slug: string; publicFormKey: string }> {
  const supabase = await createClient();
  const { data: org, error } = await supabase.rpc("create_organization", {
    org_name: name,
    org_slug: slugify(name),
  });

  if (error || !org) {
    throw new Error("Não foi possível criar a organização.");
  }

  const jar = await cookies();
  jar.set(CURRENT_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { orgId: org.id, slug: org.slug, publicFormKey: org.public_form_key };
}

export type InviteActionState = { error?: string; success?: boolean };

export async function inviteCollaboratorAction(
  email: string,
  role: OrgRole,
): Promise<InviteActionState> {
  const org = await getCurrentOrganization();
  if (!org || org.role !== "admin") {
    return { error: "Apenas admins podem convidar colaboradores." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: invite, error } = await supabase
    .from("organization_invites")
    .insert({ org_id: org.id, email, role, invited_by: user.id })
    .select("token")
    .single();

  if (error || !invite) {
    return { error: "Já existe um colaborador ou convite pendente com esse e-mail." };
  }

  await sendInviteEmail({
    to: email,
    organizationName: org.name,
    role,
    token: invite.token,
  });

  revalidatePath("/settings/team");
  return { success: true };
}

export async function changeInviteRoleAction(inviteId: string, role: OrgRole) {
  const supabase = await createClient();
  await supabase.from("organization_invites").update({ role }).eq("id", inviteId);
  revalidatePath("/settings/team");
}

export async function cancelInviteAction(inviteId: string) {
  const supabase = await createClient();
  await supabase.from("organization_invites").delete().eq("id", inviteId);
  revalidatePath("/settings/team");
}

export async function changeMemberRoleAction(memberId: string, role: OrgRole) {
  const supabase = await createClient();
  const { error } = await supabase.from("organization_members").update({ role }).eq("id", memberId);

  if (error) throw new Error("A organização precisa de pelo menos um administrador.");
  revalidatePath("/settings/team");
}

export async function removeMemberAction(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("organization_members").delete().eq("id", memberId);

  if (error) throw new Error("A organização precisa de pelo menos um administrador.");
  revalidatePath("/settings/team");
}
