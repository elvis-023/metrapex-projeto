import type { Metadata } from "next";

import { PublicQuoteForm } from "@/components/public-form/public-quote-form";
import { getProducts } from "@/lib/catalog/mock-data";
import { getPublicOrganization } from "@/lib/public-form/mock-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const organization = await getPublicOrganization(orgSlug);
  return { title: `Pedir orçamento — ${organization.name}` };
}

export default async function PublicQuoteRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ produto?: string }>;
}) {
  const { orgSlug } = await params;
  const { produto } = await searchParams;

  const [organization, products] = await Promise.all([
    getPublicOrganization(orgSlug),
    getProducts(),
  ]);

  const preloadedProductId = produto && products.some((p) => p.id === produto) ? produto : null;

  return (
    <PublicQuoteForm
      organizationName={organization.name}
      products={products}
      preloadedProductId={preloadedProductId}
    />
  );
}
