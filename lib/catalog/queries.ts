import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Product, ProductCategory } from "@/lib/catalog/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    externalCode: row.external_code,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    categoryId: row.category_id,
    photoUrl: row.photo_url,
    alternativeTitle: row.alternative_title,
    catalogUrl: row.catalog_url,
    manualUrl: row.manual_url,
    videoUrl: row.video_url,
    certificateEligible: row.certificate_eligible,
    leadTime: row.lead_time,
  };
}

export async function getProducts(): Promise<Product[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", org.id)
    .order("name");

  if (error || !data) return [];
  return data.map(toProduct);
}

export async function getCategories(): Promise<ProductCategory[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, ncm")
    .eq("org_id", org.id)
    .order("name");

  if (error || !data) return [];
  return data;
}

export type CategoryWithCount = ProductCategory & { productCount: number };

export async function getCategoriesWithCount(): Promise<CategoryWithCount[]> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return categories.map((category) => ({
    ...category,
    productCount: products.filter((product) => product.categoryId === category.id).length,
  }));
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const org = await getCurrentOrganization();
  if (!org) return undefined;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("org_id", org.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return toProduct(data);
}
