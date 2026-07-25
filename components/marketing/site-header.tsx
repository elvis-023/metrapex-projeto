import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "#features", label: "Funcionalidades" },
  { href: "#pricing", label: "Planos" },
];

export function SiteHeader() {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-xs font-bold">
            M
          </span>
          Metrapex
        </Link>

        <nav className="text-muted-foreground hidden items-center gap-5 text-sm md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/login">Entrar</Link>}
            nativeButton={false}
          />
          <Button
            size="sm"
            render={<Link href="/signup">Começar grátis</Link>}
            nativeButton={false}
          />
        </div>
      </div>
    </header>
  );
}
