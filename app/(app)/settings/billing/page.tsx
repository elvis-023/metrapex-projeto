import type { Metadata } from "next";

import { BillingPlaceholder } from "@/components/settings/billing-placeholder";
import { currentPlan, planTiers } from "@/lib/settings/mock-data";

export const metadata: Metadata = { title: "Plano e assinatura" };

export default function SettingsBillingPage() {
  return <BillingPlaceholder currentPlan={currentPlan} plans={planTiers} />;
}
