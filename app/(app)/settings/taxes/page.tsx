import type { Metadata } from "next";

import { TaxSettingsManager } from "@/components/settings/tax-settings-manager";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { initialTaxRateOverrides, initialTaxTypes } from "@/lib/settings/mock-data";

export const metadata: Metadata = { title: "Impostos" };

export default async function SettingsTaxesPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return (
    <TaxSettingsManager
      initialTaxTypes={initialTaxTypes}
      initialOverrides={initialTaxRateOverrides}
      categories={categories}
      products={products}
    />
  );
}
