import type { OrgRole } from "@/lib/supabase/types";

const roleLabels: Record<OrgRole, string> = { admin: "admin", vendedor: "vendedor" };

/**
 * Chamada direta à API HTTP da Resend — sem SDK, para não adicionar dependência
 * só por um único e-mail transacional. Se o volume de e-mails crescer (Milestone 15
 * já usa Resend para envio de orçamento), vale migrar para o SDK `resend`.
 */
export async function sendInviteEmail({
  to,
  organizationName,
  role,
  token,
}: {
  to: string;
  organizationName: string;
  role: OrgRole;
  token: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const acceptUrl = `${appUrl}/invite/${token}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // TODO: trocar para um domínio próprio verificado na Resend (ex.: convites@trezofy.com.br)
      // assim que ele for verificado — onboarding@resend.dev é o domínio sandbox, sem branding.
      from: "Trezofy <onboarding@resend.dev>",
      to,
      subject: `Convite para colaborar em ${organizationName}`,
      html: `
        <p>Você foi convidado para colaborar em <strong>${organizationName}</strong> como <strong>${roleLabels[role]}</strong>.</p>
        <p><a href="${acceptUrl}">Aceitar convite</a></p>
        <p>Este link expira em 7 dias.</p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail de convite (${response.status}).`);
  }
}

/**
 * E-mail de entrega do orçamento gerado pelo formulário público — canal
 * WhatsApp fica de fora por enquanto: condicionado ao plano (Milestone 15),
 * e billing/plano ainda não existe (Milestone 21).
 */
export async function sendQuoteEmail({
  to,
  organizationName,
  quoteNumber,
  pdfUrl,
}: {
  to: string;
  organizationName: string;
  quoteNumber: string;
  pdfUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // TODO: mesmo domínio sandbox de sendInviteEmail — trocar quando houver domínio verificado.
      from: `${organizationName} via Trezofy <onboarding@resend.dev>`,
      to,
      subject: `Seu orçamento ${quoteNumber} — ${organizationName}`,
      html: `
        <p>Olá! Segue o orçamento <strong>${quoteNumber}</strong> solicitado a <strong>${organizationName}</strong>.</p>
        <p><a href="${pdfUrl}">Baixar orçamento em PDF</a></p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail do orçamento (${response.status}).`);
  }
}

/**
 * Lembrete de follow-up (Milestone 18) — disparado pelo job agendado do n8n
 * quando um orçamento fica parado (sem mudança de status/desconto/revisão)
 * há mais dias do que o limite configurado. Vai para o vendedor responsável,
 * nunca para o cliente final.
 */
export async function sendFollowUpReminderEmail({
  to,
  sellerName,
  organizationName,
  quoteNumber,
  customerName,
  staleDays,
  quoteUrl,
}: {
  to: string;
  sellerName: string;
  organizationName: string;
  quoteNumber: string;
  customerName: string;
  staleDays: number;
  quoteUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${organizationName} via Trezofy <onboarding@resend.dev>`,
      to,
      subject: `Follow-up: orçamento ${quoteNumber} parado há ${staleDays} dias`,
      html: `
        <p>Olá, ${sellerName}!</p>
        <p>O orçamento <strong>${quoteNumber}</strong> de <strong>${customerName}</strong> está sem
        movimentação há mais de ${staleDays} dias.</p>
        <p><a href="${quoteUrl}">Abrir orçamento</a></p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail de follow-up (${response.status}).`);
  }
}

/**
 * Envio agendado de relatório (Milestone 20) — corpo é um resumo em HTML
 * (top linhas agregadas) e o anexo é o dado bruto filtrado da mesma janela,
 * já em CSV/Excel (mesmas colunas da exportação manual, `lib/reports/export.ts`).
 * Não tenta anexar gráfico: renderizar PNG/PDF de servidor exigiria um
 * navegador headless, fora do escopo deste milestone (a exportação de
 * imagem/PDF é sempre client-side, sob ação do usuário).
 */
export async function sendReportEmail({
  to,
  organizationName,
  scheduleName,
  periodLabel,
  summaryRows,
  attachment,
}: {
  to: string[];
  organizationName: string;
  scheduleName: string;
  periodLabel: string;
  summaryRows: { label: string; value: string }[];
  attachment: { filename: string; base64: string };
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const rowsHtml = summaryRows
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555;">${row.label}</td><td style="padding:4px 0;font-weight:600;">${row.value}</td></tr>`,
    )
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${organizationName} via Trezofy <onboarding@resend.dev>`,
      to,
      subject: `Relatório agendado: ${scheduleName} — ${periodLabel}`,
      html: `
        <p>Segue o relatório <strong>${scheduleName}</strong> de <strong>${organizationName}</strong>, referente a ${periodLabel}.</p>
        <table style="border-collapse:collapse;margin:12px 0;">${rowsHtml}</table>
        <p>O dado bruto filtrado do período está anexado.</p>
      `,
      attachments: [{ filename: attachment.filename, content: attachment.base64 }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail de relatório agendado (${response.status}).`);
  }
}

/**
 * Aviso de expiração automática (Milestone 18) — o orçamento já foi
 * marcado como expirado quando este e-mail é disparado; é notificação, não
 * uma chance de reverter.
 */
export async function sendQuoteExpiredEmail({
  to,
  sellerName,
  organizationName,
  quoteNumber,
  customerName,
  quoteUrl,
}: {
  to: string;
  sellerName: string;
  organizationName: string;
  quoteNumber: string;
  customerName: string;
  quoteUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${organizationName} via Trezofy <onboarding@resend.dev>`,
      to,
      subject: `Orçamento ${quoteNumber} expirou`,
      html: `
        <p>Olá, ${sellerName}!</p>
        <p>O orçamento <strong>${quoteNumber}</strong> de <strong>${customerName}</strong> venceu sem
        conversão e foi marcado como expirado automaticamente.</p>
        <p><a href="${quoteUrl}">Abrir orçamento</a></p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail de expiração (${response.status}).`);
  }
}
