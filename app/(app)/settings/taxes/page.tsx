import type { Metadata } from "next";

import { TaxSettingsManager } from "@/components/settings/tax-settings-manager";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { getCurrentOrganization } from "@/lib/auth/session";
import { initialTaxRateOverrides, initialTaxTypes } from "@/lib/settings/mock-data";
import { TAX_REGIME_LABELS, type TaxRegime } from "@/lib/tax-engine/onboarding-templates";

export const metadata: Metadata = { title: "Impostos" };

export default async function SettingsTaxesPage() {
  const [categories, products, organization] = await Promise.all([
    getCategories(),
    getProducts(),
    getCurrentOrganization(),
  ]);

  const taxRegimeLabel = organization?.taxRegime
    ? TAX_REGIME_LABELS[organization.taxRegime as TaxRegime]
    : null;

  return (
    <TaxSettingsManager
      taxRegimeLabel={taxRegimeLabel}
      initialTaxTypes={initialTaxTypes}
      initialOverrides={initialTaxRateOverrides}
      categories={categories}
      products={products}
    />
  );
}
