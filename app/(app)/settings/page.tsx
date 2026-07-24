import { Settings } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

export default function SettingsPage() {
  return (
    <EmptyState
      icon={Settings}
      title="Configurações chegam no Milestone 10"
      description="Impostos, condições de pagamento, template de PDF e colaboradores serão configurados aqui."
    />
  );
}
