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
      // TODO: trocar para um domínio próprio verificado na Resend (ex.: convites@metrapex.com.br)
      // assim que ele for verificado — onboarding@resend.dev é o domínio sandbox, sem branding.
      from: "Metrapex <onboarding@resend.dev>",
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
