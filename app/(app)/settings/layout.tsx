import type { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-medium">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Impostos, condições de pagamento, documento e time da organização.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
