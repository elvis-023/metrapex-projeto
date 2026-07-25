"use client";

import { useEffect, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

/**
 * Espaço reservado visual do Cloudflare Turnstile (captcha invisível) — a
 * verificação real acontece no Milestone 15. Aqui só simula o widget
 * "resolvendo" logo após montar, para a tela não parecer incompleta.
 */
export function CaptchaPlaceholder({ onVerified }: { onVerified: () => void }) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVerified(true);
      onVerified();
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border-border bg-muted/40 flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
      <ShieldCheckIcon
        className={verified ? "text-primary size-4" : "text-muted-foreground size-4"}
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium">
          {verified ? "Verificação concluída" : "Verificando que você não é um robô…"}
        </span>
        <span className="text-muted-foreground text-[0.7rem]">
          Protegido por Cloudflare Turnstile
        </span>
      </div>
    </div>
  );
}
