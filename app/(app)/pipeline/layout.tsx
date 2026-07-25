import type { ReactNode } from "react";

import { PipelineProvider } from "@/lib/pipeline/pipeline-context";
import { getPipelineQuotes } from "@/lib/pipeline/mock-data";

export default async function PipelineLayout({ children }: { children: ReactNode }) {
  const quotes = await getPipelineQuotes();

  return <PipelineProvider initialQuotes={quotes}>{children}</PipelineProvider>;
}
