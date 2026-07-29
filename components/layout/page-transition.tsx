"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `<main>` do AppShell não desmonta entre navegações — só `children` troca.
 * A `key={pathname}` força o React a recriar este wrapper a cada rota, o
 * que reinicia a animação CSS (senão ela só tocaria uma vez, no primeiro load).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  );
}
