import type { Metadata } from "next";

import { Hero } from "@/components/marketing/hero";
import { FeaturesSection } from "@/components/marketing/features-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { CtaSection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Trezofy — Orçamento automático e CRM enxuto",
  openGraph: {
    title: "Trezofy — Orçamento automático e CRM enxuto",
    description: "Geração automática de orçamentos e CRM enxuto para times de vendas.",
    siteName: "Trezofy",
    type: "website",
    locale: "pt_BR",
  },
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeaturesSection />
      <PricingSection />
      <CtaSection />
    </>
  );
}
