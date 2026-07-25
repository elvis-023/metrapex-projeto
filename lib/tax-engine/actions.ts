"use server";

import {
  buildTaxTemplatePlan,
  parseBrRate,
  type TaxTemplateId,
} from "@/lib/tax-engine/onboarding-templates";
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
