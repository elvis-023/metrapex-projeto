import { NextResponse, type NextRequest } from "next/server";

import { verifyAutomationSecret } from "@/lib/automations/auth";
import { createAutomationsServiceClient } from "@/lib/automations/service-client";
import { sendFollowUpReminderEmail } from "@/lib/integrations/resend";
import { formatQuoteNumber } from "@/lib/quotes/engine";

const JOB_NAME = "follow_up";
// Absorve retry/disparo duplicado do n8n dentro da mesma hora — job real
// roda no máximo uma vez por dia, então a janela nunca bloqueia a execução
// legítima do dia seguinte.
const CLAIM_WINDOW_SECONDS = 3600;
const DEFAULT_STALE_DAYS = 3;

type FollowUpSummary = {
  checked: number;
  notified: number;
  skipped: number;
  errors: string[];
};

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  if (!verifyAutomationSecret(request)) return unauthorized();

  let staleDays = DEFAULT_STALE_DAYS;
  try {
    const body = await request.json();
    if (typeof body?.staleDays === "number" && body.staleDays > 0) {
      staleDays = body.staleDays;
    }
  } catch {
    // Corpo vazio é aceitável — o n8n pode chamar sem payload e usar o padrão.
  }

  const supabase = createAutomationsServiceClient();

  const { data: claim, error: claimError } = await supabase
    .rpc("automation_claim_run", { p_job_name: JOB_NAME, p_window_seconds: CLAIM_WINDOW_SECONDS })
    .maybeSingle();

  if (claimError || !claim) {
    console.error("[automations/follow-up] falha ao reivindicar execução", claimError);
    return NextResponse.json({ error: "Falha ao iniciar job." }, { status: 500 });
  }

  if (!claim.claimed) {
    // Execução concorrente em andamento (`processing`) ou já concluída
    // nesta janela (`done`, com o resumo anterior) — não reprocessa.
    return NextResponse.json(
      { skipped: true, reason: claim.status, summary: claim.summary },
      { status: 409 },
    );
  }

  const summary: FollowUpSummary = { checked: 0, notified: 0, skipped: 0, errors: [] };

  try {
    const { data: staleQuotes, error: findError } = await supabase.rpc(
      "automation_find_stale_quotes",
      { p_stale_days: staleDays },
    );
    if (findError) throw findError;

    summary.checked = staleQuotes?.length ?? 0;

    for (const quote of staleQuotes ?? []) {
      try {
        await sendFollowUpReminderEmail({
          to: quote.owner_email,
          sellerName: quote.owner_name,
          organizationName: quote.org_name,
          quoteNumber: formatQuoteNumber(quote.sequence),
          customerName: quote.customer_name,
          staleDays,
          quoteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pipeline/${quote.quote_id}`,
        });
        summary.notified += 1;
      } catch (error) {
        summary.errors.push(`${quote.quote_id}: ${(error as Error).message}`);
        continue;
      }

      // Registro da timeline isolado do envio de propósito (mesma disciplina
      // de app/api/public-quote/route.ts): e-mail que falhou não é "lembrete
      // enviado", mas uma falha ao GRAVAR a atividade de um e-mail que saiu
      // não deve ser confundida com falha de envio nem impedir o cooldown de
      // funcionar como esperado da próxima vez.
      const { error: activityError } = await supabase.rpc("record_system_quote_activity", {
        p_quote_id: quote.quote_id,
        p_type: "follow_up",
        p_label: "Lembrete de follow-up enviado automaticamente",
        p_detail: `Parado há mais de ${staleDays} dia(s) sem movimentação.`,
      });
      if (activityError) {
        summary.errors.push(`${quote.quote_id} (atividade): ${activityError.message}`);
      }
    }

    await supabase.rpc("automation_complete_run", {
      p_job_name: JOB_NAME,
      p_window_bucket: claim.run_window,
      p_summary: summary,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[automations/follow-up] falha", error);
    await supabase.rpc("automation_fail_run", {
      p_job_name: JOB_NAME,
      p_window_bucket: claim.run_window,
      p_error: (error as Error).message,
    });
    return NextResponse.json({ error: "Falha ao executar job." }, { status: 500 });
  }
}
