import type { Metadata } from "next";

import { TaxSettingsManager } from "@/components/settings/tax-settings-manager";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { getCurrentOrganization } from "@/lib/auth/session";
import { getTaxConfiguration } from "@/lib/quotes/queries";
import type { TaxRateOverrideSetting, TaxTypeSetting } from "@/lib/settings/types";
import { isValidTaxRegime } from "@/lib/tax-engine/onboarding-templates";

export const metadata: Metadata = { title: "Impostos" };

export default async function SettingsTaxesPage() {
  const organization = await getCurrentOrganization();
  if (!organization) return null;

  const [categories, products, config] = await Promise.all([
    getCategories(),
    getProducts(),
    getTaxConfiguration(organization.id),
  ]);

  const taxTypes: TaxTypeSetting[] = config.taxTypes.map((taxType) => ({
    id: taxType.id,
    code: taxType.code,
    label: taxType.label,
    mode: taxType.mode,
    defaultRate: taxType.defaultRate,
  }));

  // `id` sempre vem preenchido aqui — getTaxConfiguration lê de tax_rates
  // real, que sempre tem id; só as fixtures de teste do motor omitem esse
  // campo (ele é opcional só para não obrigar todo teste a inventar um id).
  const overrides: TaxRateOverrideSetting[] = config.overrides.map((override) => ({
    id: override.id!,
    taxTypeId: override.taxTypeId,
    scope: override.categoryId ? "category" : "product",
    categoryId: override.categoryId,
    productId: override.productId,
    rate: override.rate,
    note: override.note,
  }));

  const taxRegime =
    organization.taxRegime && isValidTaxRegime(organization.taxRegime)
      ? organization.taxRegime
      : null;

  return (
    <TaxSettingsManager
      taxRegime={taxRegime}
      initialTaxTypes={taxTypes}
      initialOverrides={overrides}
      initialDocumentFooter={config.documentFooter}
      initialShowTaxLines={config.showTaxLines}
      initialOrganizationState={organization.state}
      categories={categories}
      products={products}
    />
  );
}
