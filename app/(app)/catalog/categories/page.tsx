import type { Metadata } from "next";

import { CategoryManager } from "@/components/catalog/category-manager";
import { getCategories, getProducts } from "@/lib/catalog/mock-data";

export const metadata: Metadata = { title: "Categorias" };

export default async function CatalogCategoriesPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  const categoriesWithCount = categories.map((category) => ({
    ...category,
    productCount: products.filter((product) => product.categoryId === category.id).length,
  }));

  return <CategoryManager initialCategories={categoriesWithCount} />;
}
