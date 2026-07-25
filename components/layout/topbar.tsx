"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionOrganization, SessionUser } from "@/lib/auth/session";

export function Topbar({
  user,
  organizations,
  currentOrganization,
}: {
  user: SessionUser;
  organizations: SessionOrganization[];
  currentOrganization: SessionOrganization;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir menu de navegação"
          className="md:hidden"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu />
        </Button>
        <SheetContent side="left" className="w-64 p-0 sm:max-w-64">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <OrgSwitcher organizations={organizations} currentOrganization={currentOrganization} />

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
