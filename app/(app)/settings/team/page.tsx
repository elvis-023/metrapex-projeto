import type { Metadata } from "next";

import { TeamManager } from "@/components/settings/team-manager";
import { getAuthUser, getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { TeamInvite, TeamMember } from "@/lib/settings/types";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function SettingsTeamPage() {
  const org = await getCurrentOrganization();
  const authUser = await getAuthUser();
  if (!org || !authUser) return null;

  const supabase = await createClient();

  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, role, user_id, profiles(full_name, email)")
      .eq("org_id", org.id)
      .returns<
        {
          id: string;
          role: TeamMember["role"];
          user_id: string;
          profiles: { full_name: string; email: string } | null;
        }[]
      >(),
    supabase
      .from("organization_invites")
      .select("id, email, role, created_at")
      .eq("org_id", org.id)
      .is("accepted_at", null)
      .returns<{ id: string; email: string; role: TeamInvite["role"]; created_at: string }[]>(),
  ]);

  const members: TeamMember[] = (memberRows ?? []).map((row) => ({
    id: row.id,
    name: row.profiles?.full_name ?? row.profiles?.email ?? "Colaborador",
    email: row.profiles?.email ?? "",
    role: row.role,
    isCurrentUser: row.user_id === authUser.id,
  }));

  const invites: TeamInvite[] = (inviteRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    invitedAt: row.created_at.slice(0, 10),
  }));

  return <TeamManager initialMembers={members} initialInvites={invites} />;
}
