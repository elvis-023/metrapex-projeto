import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-bold">
          T
        </span>
        Trezofy
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
