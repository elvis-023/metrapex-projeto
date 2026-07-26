import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicQuoteForm } from "@/components/public-form/public-quote-form";
import { resolvePublicForm } from "./resolve-public-organization";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicFormKey: string }>;
}): Promise<Metadata> {
  const { publicFormKey } = await params;
  const resolved = await resolvePublicForm(publicFormKey);
  return {
    title: resolved ? `Pedir orçamento — ${resolved.organization.name}` : "Formulário não encontrado",
  };
}

export default async function PublicQuoteRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicFormKey: string }>;
  searchParams: Promise<{ produto?: string }>;
}) {
  const { publicFormKey } = await params;
  const { produto } = await searchParams;

  const resolved = await resolvePublicForm(publicFormKey);
  if (!resolved) notFound();

  const { organization, products } = resolved;

  const preloadedProductId =
    produto && products.some((product) => product.id === produto) ? produto : null;

  return (
    <PublicQuoteForm
      publicFormKey={publicFormKey}
      organizationName={organization.name}
      products={products}
      preloadedProductId={preloadedProductId}
    />
  );
}
