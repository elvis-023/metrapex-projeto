import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  getCurrentOrganization,
  getCurrentUserProfile,
  getUserOrganizations,
} from "@/lib/auth/session";
import { getPipelineQuotes } from "@/lib/pipeline/mock-data";
import { PipelineProvider } from "@/lib/pipeline/pipeline-context";

/**
 * `PipelineProvider` vive aqui, no layout de todo o painel autenticado
 * — não só em `/pipeline` — porque a criação de orçamento em `/quotes/new`
 * também precisa gravar no estado local do pipeline (mock, sem
 * persistência real ainda) para o orçamento aparecer no board.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, organizations, currentOrganization, quotes] = await Promise.all([
    getCurrentUserProfile(),
    getUserOrganizations(),
    getCurrentOrganization(),
    getPipelineQuotes(),
  ]);

  if (!user) {
    redirect("/login");
  }

  // Usuário autenticado sem nenhuma organização — ainda não passou pelo onboarding.
  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  return (
    <PipelineProvider initialQuotes={quotes}>
      <AppShell
        user={user}
        organizations={organizations}
        currentOrganization={currentOrganization!}
      >
        {children}
      </AppShell>
    </PipelineProvider>
  );
}
