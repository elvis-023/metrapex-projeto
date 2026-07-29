import { Logo } from "@/components/shared/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
        <Logo href="/dashboard" size="md" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
    </div>
  );
}
