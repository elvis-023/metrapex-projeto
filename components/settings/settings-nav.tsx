"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const settingsNavItems = [
  { title: "Impostos", href: "/settings/taxes" },
  { title: "Pagamento", href: "/settings/payment-terms" },
  { title: "Template de PDF", href: "/settings/pdf-template" },
  { title: "Colaboradores", href: "/settings/team" },
  { title: "Plano", href: "/settings/billing" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Seções de configuração">
      {settingsNavItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
