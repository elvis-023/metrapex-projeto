import type { ReactNode } from "react";

import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo size="md" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
