import type { Metadata } from "next";

import { TeamManager } from "@/components/settings/team-manager";
import { initialTeamInvites, initialTeamMembers } from "@/lib/settings/mock-data";

export const metadata: Metadata = { title: "Colaboradores" };

export default function SettingsTeamPage() {
  return <TeamManager initialMembers={initialTeamMembers} initialInvites={initialTeamInvites} />;
}
