import type { ReactNode } from "react";

/**
 * Sem sidebar/topbar do painel — esta rota roda embutida via iframe/snippet
 * no site do cliente, então o layout precisa ser independente e caber em
 * containers estreitos (a partir de ~320px).
 */
export default function PublicFormLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-4 px-3 py-6 sm:px-4">
      {children}
      <p className="text-muted-foreground text-center text-[0.7rem]">
        Orçamento gerado por <span className="text-foreground font-medium">Trezofy</span>
      </p>
    </div>
  );
}
