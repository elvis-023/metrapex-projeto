import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getPipelineQuotes } from "@/lib/pipeline/mock-data";
import { PipelineProvider } from "@/lib/pipeline/pipeline-context";

/**
 * `PipelineProvider` vive aqui, no layout de todo o painel autenticado
 * — não só em `/pipeline` — porque a criação de orçamento em `/quotes/new`
 * também precisa gravar no estado local do pipeline (mock, sem
 * persistência real ainda) para o orçamento aparecer no board.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const quotes = await getPipelineQuotes();

  return (
    <PipelineProvider initialQuotes={quotes}>
      <AppShell>{children}</AppShell>
    </PipelineProvider>
  );
}
