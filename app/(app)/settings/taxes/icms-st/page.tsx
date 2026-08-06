import type { Metadata } from "next";

import { IcmsStManager } from "@/components/settings/icms-st-manager";
import { getCategories } from "@/lib/catalog/queries";
import { getIcmsStStateRulesByOrg } from "@/lib/tax-engine/icms-st-queries";

export const metadata: Metadata = { title: "ICMS-ST por estado" };

export default async function SettingsIcmsStPage() {
  const [categories, rules] = await Promise.all([getCategories(), getIcmsStStateRulesByOrg()]);

  return <IcmsStManager categories={categories} initialRules={rules} />;
}
