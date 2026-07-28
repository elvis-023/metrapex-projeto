import type { ReactNode } from "react";

import { ReportsNav } from "@/components/reports/reports-nav";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-medium">Relatórios</h1>
        <p className="text-muted-foreground text-sm">
          Pré-construídos, relatório sob medida e envio agendado por e-mail.
        </p>
      </div>
      <ReportsNav />
      {children}
    </div>
  );
}
