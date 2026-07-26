import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  getCurrentOrganization,
  getCurrentUserProfile,
  getUserOrganizations,
} from "@/lib/auth/session";
import { getBoardQuotes } from "@/lib/pipeline/board";
import { PipelineProvider } from "@/lib/pipeline/pipeline-context";

/**
 * `PipelineProvider` vive aqui, no layout de todo o painel autenticado — não
 * só em `/pipeline` — porque o board e a página de detalhe compartilham a
 * etapa movida por arrastar-e-soltar na sessão. Os orçamentos em si já vêm do
 * banco (Milestone 14); só a etapa arrastada ainda é estado local
 * (Milestone 16).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, organizations, currentOrganization, quotes] = await Promise.all([
    getCurrentUserProfile(),
    getUserOrganizations(),
    getCurrentOrganization(),
    getBoardQuotes(),
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
