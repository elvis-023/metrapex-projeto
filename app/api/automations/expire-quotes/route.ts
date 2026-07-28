import { NextResponse, type NextRequest } from "next/server";

import { verifyAutomationSecret } from "@/lib/automations/auth";
import { createAutomationsServiceClient } from "@/lib/automations/service-client";
import { sendQuoteExpiredEmail } from "@/lib/integrations/resend";
import { formatQuoteNumber } from "@/lib/quotes/engine";

const JOB_NAME = "expire_quotes";
const CLAIM_WINDOW_SECONDS = 3600;

type ExpireSummary = {
  checked: number;
  expired: number;
  notified: number;
  errors: string[];
};

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  if (!verifyAutomationSecret(request)) return unauthorized();

  const supabase = createAutomationsServiceClient();

  const { data: claim, error: claimError } = await supabase
    .rpc("automation_claim_run", { p_job_name: JOB_NAME, p_window_seconds: CLAIM_WINDOW_SECONDS })
    .maybeSingle();

  if (claimError || !claim) {
    console.error("[automations/expire-quotes] falha ao reivindicar execução", claimError);
    return NextResponse.json({ error: "Falha ao iniciar job." }, { status: 500 });
  }

  if (!claim.claimed) {
    return NextResponse.json(
      { skipped: true, reason: claim.status, summary: claim.summary },
      { status: 409 },
    );
  }

  const summary: ExpireSummary = { checked: 0, expired: 0, notified: 0, errors: [] };

  try {
    const { data: candidates, error: findError } = await supabase.rpc(
      "automation_find_expirable_quotes",
    );
    if (findError) throw findError;

    summary.checked = candidates?.length ?? 0;

    for (const quote of candidates ?? []) {
      // Reconfere e muda o status de forma atômica — um vendedor pode ter
      // convertido o orçamento entre a leitura acima e este passo. Se não
      // expirou (já convertido/expirado por outra via), não há nada mais a
      // fazer para esta linha.
      let expired: boolean;
      try {
        const { data, error: expireError } = await supabase
          .rpc("automation_expire_quote", { p_quote_id: quote.quote_id })
          .single();
        if (expireError) throw expireError;
        expired = Boolean(data);
      } catch (error) {
        summary.errors.push(`${quote.quote_id}: ${(error as Error).message}`);
        continue;
      }
      if (!expired) continue;

      summary.expired += 1;

      const { error: activityError } = await supabase.rpc("record_system_quote_activity", {
        p_quote_id: quote.quote_id,
        p_type: "mudanca_status",
        p_label: "Expirado automaticamente",
        p_detail: "Prazo de validade vencido sem conversão.",
      });
      if (activityError) {
        summary.errors.push(`${quote.quote_id} (atividade): ${activityError.message}`);
      }

      // E-mail é melhor esforço — o orçamento já está expirado independente
      // dele, e sem dono (orçamento nascido do formulário público) não há
      // para quem notificar.
      if (quote.owner_email) {
        try {
          await sendQuoteExpiredEmail({
            to: quote.owner_email,
            sellerName: quote.owner_name ?? "vendedor",
            organizationName: quote.org_name,
            quoteNumber: formatQuoteNumber(quote.sequence),
            customerName: quote.customer_name,
            quoteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pipeline/${quote.quote_id}`,
          });
          summary.notified += 1;
        } catch (error) {
          summary.errors.push(`${quote.quote_id} (e-mail): ${(error as Error).message}`);
        }
      }
    }

    await supabase.rpc("automation_complete_run", {
      p_job_name: JOB_NAME,
      p_window_bucket: claim.run_window,
      p_summary: summary,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[automations/expire-quotes] falha", error);
    await supabase.rpc("automation_fail_run", {
      p_job_name: JOB_NAME,
      p_window_bucket: claim.run_window,
      p_error: (error as Error).message,
    });
    return NextResponse.json({ error: "Falha ao executar job." }, { status: 500 });
  }
}
