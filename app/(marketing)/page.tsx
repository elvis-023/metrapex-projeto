import type { Metadata } from "next";

import { Hero } from "@/components/marketing/hero";
import { FeaturesSection } from "@/components/marketing/features-section";
import { SuccessCases } from "@/components/marketing/success-cases";
import { PricingSection } from "@/components/marketing/pricing-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { WaveSeparator } from "@/components/marketing/wave-separator";

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
      <WaveSeparator />
      <FeaturesSection />
      <WaveSeparator />
      <SuccessCases />
      <WaveSeparator />
      <PricingSection />
      <WaveSeparator />
      <CtaSection />
    </>
  );
}
