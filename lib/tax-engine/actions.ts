"use server";

import {
  buildTaxTemplatePlan,
  parseBrRate,
  type TaxTemplateId,
} from "@/lib/tax-engine/onboarding-templates";
import { defaultPaymentConditions, defaultPaymentValueBands } from "@/lib/quotes/payment-defaults";
import { createClient } from "@/lib/supabase/server";

export type OnboardingTaxTemplateState = {
  templateId: TaxTemplateId;
  icmsRate: string;
  footerText: string;
};

/**
 * Grava o template fiscal escolhido no passo 2 do onboarding (briefing §6).
 * Chamada por `handleFinish` logo após `createOrganizationAction` — mesma
 * transação lógica de conclusão do wizard.
 */
export async function applyTaxTemplateAction(orgId: string, state: OnboardingTaxTemplateState) {
  const plan = buildTaxTemplatePlan({
    templateId: state.templateId,
    icmsRate: parseBrRate(state.icmsRate),
    footerText: state.footerText,
  });
  const supabase = await createClient();

  const { error: settingsError } = await supabase.from("tax_settings").insert({
    org_id: orgId,
    document_footer: plan.settings.documentFooter,
    show_tax_lines: plan.settings.showTaxLines,
  });
  if (settingsError) {
    throw new Error("Não foi possível configurar o template fiscal.");
  }

  if (plan.taxTypes.length > 0) {
    const { error: taxTypesError } = await supabase.from("tax_types").insert(
      plan.taxTypes.map((taxType) => ({
        org_id: orgId,
        code: taxType.code,
        label: taxType.label,
        mode: taxType.mode,
        default_rate: taxType.defaultRate,
        display_order: taxType.displayOrder,
      })),
    );
    if (taxTypesError) {
      throw new Error("Não foi possível configurar os tributos do template fiscal.");
    }
  }
}

/**
 * Grava a sugestão-padrão de condições de pagamento e faixas de valor
 * (passo 4 do onboarding). A partir daqui o motor de orçamento tem o que
 * aplicar no cálculo — sem nenhuma condição configurada, o orçamento sai sem
 * desconto de pagamento e sem restrição de faixa.
 */
export async function applyPaymentDefaultsAction(orgId: string) {
  const supabase = await createClient();

  const { data: conditions, error: conditionsError } = await supabase
    .from("payment_conditions")
    .insert(
      defaultPaymentConditions.map((condition) => ({
        org_id: orgId,
        label: condition.label,
        kind: condition.kind,
        discount_percent: condition.discountPercent,
        installments: condition.installments,
        term_days: condition.termDays,
        display_order: condition.displayOrder,
      })),
    )
    .select("id, label");

  if (conditionsError || !conditions) {
    throw new Error("Não foi possível configurar as condições de pagamento.");
  }

  const idByKey = new Map(
    defaultPaymentConditions.map((seed) => [
      seed.key,
      conditions.find((row) => row.label === seed.label)?.id,
    ]),
  );

  for (const band of defaultPaymentValueBands) {
    const { data: bandRow, error: bandError } = await supabase
      .from("payment_value_bands")
      .insert({
        org_id: orgId,
        label: band.label,
        min_value: band.minValue,
        max_value: band.maxValue,
      })
      .select("id")
      .single();

    if (bandError || !bandRow) {
      throw new Error("Não foi possível configurar as faixas de valor.");
    }

    const links = band.conditionKeys
      .map((key) => idByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((id) => ({ band_id: bandRow.id, payment_condition_id: id }));

    if (links.length > 0) {
      const { error: linkError } = await supabase.from("payment_band_conditions").insert(links);
      if (linkError) {
        throw new Error("Não foi possível vincular as condições às faixas de valor.");
      }
    }
  }
}
