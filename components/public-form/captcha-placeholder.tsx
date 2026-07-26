"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: { sitekey: string; callback: (token: string) => void },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Widget real do Cloudflare Turnstile — o token que ele devolve só tem
 * validade quando verificado no servidor via `siteverify`
 * (lib/integrations/turnstile.ts), dentro do route handler do formulário
 * público. Este componente não decide nada sozinho, só coleta o token.
 */
export function CaptchaPlaceholder({ onVerified }: { onVerified: (token: string) => void }) {
  const [verified, setVerified] = useState(false);
  const containerId = useId().replace(/:/g, "");
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;

    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile) return;
      widgetId.current = window.turnstile.render(`#${containerId}`, {
        sitekey: siteKey,
        callback: (token) => {
          setVerified(true);
          onVerified(token);
        },
      });
    });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
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
      <div id={containerId} />
    </div>
  );
}
