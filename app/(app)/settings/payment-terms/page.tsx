import type { Metadata } from "next";

import { PaymentTermsManager } from "@/components/settings/payment-terms-manager";
import { initialPaymentConditions, initialPaymentValueBands } from "@/lib/settings/mock-data";

export const metadata: Metadata = { title: "Condições de pagamento" };

export default function SettingsPaymentTermsPage() {
  return (
    <PaymentTermsManager
      initialConditions={initialPaymentConditions}
      initialBands={initialPaymentValueBands}
    />
  );
}
