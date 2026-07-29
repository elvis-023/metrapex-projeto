import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-md text-[0.65rem] font-bold">
            T
          </span>
          Trezofy
        </div>

        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} Trezofy. Todos os direitos reservados.
        </p>

        <nav className="text-muted-foreground flex items-center gap-4 text-sm">
          <Link href="/terms" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Política de Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
