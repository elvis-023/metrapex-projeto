import { describe, expect, it } from "vitest";

import { isWhatsAppEligiblePlan } from "@/lib/integrations/n8n";

/**
 * Gate do canal WhatsApp do formulário público (Milestone 15). Testado
 * isoladamente porque o caminho de ponta a ponta só chama
 * `triggerWhatsAppQuoteDelivery` depois de um PDF gerado com sucesso, que
 * exige credenciais reais do PDFMonkey — inalcançável em dev local.
 */
describe("isWhatsAppEligiblePlan", () => {
  it("plano entrada não libera WhatsApp", () => {
    expect(isWhatsAppEligiblePlan("entrada")).toBe(false);
  });

  it("plano profissional libera WhatsApp", () => {
    expect(isWhatsAppEligiblePlan("profissional")).toBe(true);
  });

  it("plano escala libera WhatsApp", () => {
    expect(isWhatsAppEligiblePlan("escala")).toBe(true);
  });

  it("valor desconhecido não libera WhatsApp", () => {
    expect(isWhatsAppEligiblePlan("plano-que-nao-existe")).toBe(false);
  });
});
