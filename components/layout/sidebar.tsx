import Link from "next/link";

import { SidebarNav } from "@/components/layout/sidebar-nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-bold">
            M
          </span>
          Metrapex
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
    </div>
  );
}
