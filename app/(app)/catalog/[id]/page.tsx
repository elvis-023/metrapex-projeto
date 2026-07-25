import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/catalog/product-form";
import { getCategories, getProductById } from "@/lib/catalog/mock-data";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductById(id), getCategories()]);

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Editar produto</h1>
        <p className="text-muted-foreground text-sm">
          {product.externalCode} · {product.name}
        </p>
      </div>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
