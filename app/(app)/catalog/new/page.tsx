import type { Metadata } from "next";

import { ProductForm } from "@/components/catalog/product-form";
import { getCategories } from "@/lib/catalog/mock-data";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Novo produto</h1>
        <p className="text-muted-foreground text-sm">
          Cadastre um produto manualmente no catálogo da organização.
        </p>
      </div>
      <ProductForm categories={categories} />
    </div>
  );
}
