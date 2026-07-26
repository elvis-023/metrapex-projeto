import type { Metadata } from "next";

import { CategoryManager } from "@/components/catalog/category-manager";
import { getCategoriesWithCount } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "Categorias" };

export default async function CatalogCategoriesPage() {
  const categories = await getCategoriesWithCount();

  return <CategoryManager initialCategories={categories} />;
}
