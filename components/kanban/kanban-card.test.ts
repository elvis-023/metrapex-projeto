import { describe, expect, it } from "vitest";

import { expiryLabel, expiryTone } from "@/components/kanban/kanban-card";

/**
 * `quotes.expires_at` é `date` nullable (Milestone 14, migration
 * 20260726000009_quote_engine.sql) — um orçamento sem validade definida é
 * estado normal, não exceção. `lib/pipeline/board.ts` chegou a mascarar
 * `null` como `""` pra caber no tipo mockado antigo (`FakeQuote.expiresAt:
 * string`), e isso derrubava a página inteira do Pipeline com `RangeError:
 * Invalid time value` (Intl.DateTimeFormat em cima de uma data inválida)
 * pra QUALQUER organização com um orçamento assim — não era bug isolado de
 * um usuário. Estes testes travam o `null` explicitamente.
 */
describe("expiryLabel", () => {
  it("sem validade → 'Sem prazo', nunca tenta formatar data inválida", () => {
    expect(expiryLabel(null)).toBe("Sem prazo");
  });

  it("com validade → formata a data (dd/mm)", () => {
    expect(expiryLabel("2026-08-25")).toBe("25/08");
  });
});

describe("expiryTone", () => {
  it("sem validade, status aberto → tom neutro (não lança)", () => {
    expect(expiryTone(null, "gerado")).toBe("text-muted-foreground");
  });

  it("sem validade, expirado → ainda assim tom de perigo (status manda)", () => {
    expect(expiryTone(null, "expirado")).toBe("text-danger");
  });

  it("sem validade, convertido → tom neutro", () => {
    expect(expiryTone(null, "convertido")).toBe("text-muted-foreground");
  });

  it("com validade vencendo em 1 dia → tom de alerta", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    expect(expiryTone(iso, "gerado")).toBe("text-warning");
  });
});
