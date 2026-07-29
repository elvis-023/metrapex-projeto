import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";
import type { SessionOrganization, SessionUser } from "@/lib/auth/session";

export function AppShell({
  children,
  user,
  organizations,
  currentOrganization,
}: {
  children: ReactNode;
  user: SessionUser;
  organizations: SessionOrganization[];
  currentOrganization: SessionOrganization;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="border-sidebar-border hidden w-60 shrink-0 border-r md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          organizations={organizations}
          currentOrganization={currentOrganization}
        />
        <main className="flex-1 p-4 md:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
