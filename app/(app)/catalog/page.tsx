import Link from "next/link";
import { PlusIcon, TagIcon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductFilters } from "@/components/catalog/product-filters";
import { ProductTable } from "@/components/catalog/product-table";
import { getCategories, getProducts } from "@/lib/catalog/mock-data";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  const normalizedQuery = q.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.externalCode.toLowerCase().includes(normalizedQuery);
    const matchesCategory = category.length === 0 || product.categoryId === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProductFilters categories={categories} q={q} categoryId={category} />
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/catalog/categories">
                <TagIcon />
                Categorias
              </Link>
            }
            nativeButton={false}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/catalog/import">
                <UploadIcon />
                Importar planilha
              </Link>
            }
            nativeButton={false}
          />
          <Button
            size="sm"
            render={
              <Link href="/catalog/new">
                <PlusIcon />
                Novo produto
              </Link>
            }
            nativeButton={false}
          />
        </div>
      </div>

      <ProductTable
        products={filteredProducts}
        categories={categories}
        hasAnyProducts={products.length > 0}
      />
    </div>
  );
}
