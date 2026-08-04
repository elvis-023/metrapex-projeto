import { describe, expect, it } from "vitest";

import { bestMatchHref } from "@/components/layout/sidebar-nav";

/**
 * "Criar Orçamento" (`/quotes/new`) e "Orçamentos" (`/quotes`) compartilham
 * prefixo: sem escolher o href MAIS ESPECÍFICO, os dois itens acenderiam
 * como ativos ao mesmo tempo em `/quotes/new`.
 */
describe("bestMatchHref", () => {
  it("/quotes/new casa só com 'Criar Orçamento', não com 'Orçamentos'", () => {
    expect(bestMatchHref("/quotes/new")).toBe("/quotes/new");
  });

  it("/quotes casa com 'Orçamentos'", () => {
    expect(bestMatchHref("/quotes")).toBe("/quotes");
  });

  it("subrota de detalhe casa por prefixo", () => {
    expect(bestMatchHref("/pipeline/abc-123")).toBe("/pipeline");
  });

  it("rota sem correspondência não acende nada", () => {
    expect(bestMatchHref("/login")).toBeUndefined();
  });
});
