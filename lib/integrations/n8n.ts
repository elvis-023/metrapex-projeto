/**
 * Sem billing (Milestone 21) ainda, `organizations.plan` é a única fonte de
 * verdade de plano que existe — não é payment-enforced (pendência registrada
 * em docs/PLAN.md > Milestone 21), mas já é real o suficiente para gatear um
 * canal de entrega opcional. Função pura e exportada separadamente (em vez
 * de inline no route handler) porque testar via HTTP de ponta a ponta exige
 * geração de PDF bem-sucedida — que por sua vez exige credenciais reais do
 * PDFMonkey — então essa é a peça testável sem infraestrutura externa.
 */
export function isWhatsAppEligiblePlan(plan: string): boolean {
  return plan === "profissional" || plan === "escala";
}

/**
 * n8n é responsável só por envio de e-mail/WhatsApp e rotinas agendadas
 * (CLAUDE.md) — o Next.js nunca fala com a API do WhatsApp diretamente, só
 * aciona o webhook e n8n cuida da entrega. Diferente do e-mail (Resend,
 * chamado direto por estar no caminho crítico do KPI de tempo até o
 * primeiro orçamento), o WhatsApp é canal condicionado ao plano e não
 * bloqueia a resposta ao cliente final — best-effort, como o PDF/e-mail.
 */
export async function triggerWhatsAppQuoteDelivery(params: {
  phone: string;
  organizationName: string;
  quoteNumber: string;
  pdfUrl: string;
}): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) {
    throw new Error("N8N_WEBHOOK_URL/N8N_WEBHOOK_SECRET não configurados.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      channel: "whatsapp",
      phone: params.phone,
      organizationName: params.organizationName,
      quoteNumber: params.quoteNumber,
      pdfUrl: params.pdfUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao acionar o webhook do n8n (${response.status}).`);
  }
}
