import type { Metadata } from "next";

import { CustomerSourceManager } from "@/components/customers/customer-source-manager";
import { getCustomerSources } from "@/lib/customers/mock-data";
import { fakePipelineQuotes } from "@/lib/pipeline/mock-data";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage() {
  const sources = await getCustomerSources();

  const sourcesWithCount = sources.map((source) => ({
    ...source,
    quoteCount: fakePipelineQuotes.filter((quote) => quote.sourceId === source.id).length,
  }));

  return <CustomerSourceManager initialSources={sourcesWithCount} />;
}
