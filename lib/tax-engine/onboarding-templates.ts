import type { TaxMode } from "@/lib/tax-engine/types";

export type TaxTemplateId = "simples" | "isento" | "icms-ipi";

export type TaxTemplateInput = {
  templateId: TaxTemplateId;
  /** Alíquota de ICMS informada pelo usuário no passo 2 do wizard, em %. */
  icmsRate: number;
  footerText: string;
};

export type TaxTypePlanRow = {
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;
  displayOrder: number;
};

export type TaxSettingsPlan = {
  documentFooter: string | null;
  showTaxLines: boolean;
};

export type TaxTemplatePlan = {
  taxTypes: TaxTypePlanRow[];
  settings: TaxSettingsPlan;
};

/**
 * Monta o plano de inserts dos templates de onboarding fiscal (briefing §6).
 * Função pura — não toca banco; `applyTaxTemplateAction` (lib/tax-engine/actions.ts)
 * usa este plano para gravar via Supabase ao final do wizard.
 *
 * O IPI do template "ICMS + IPI padrão" nasce com `default_rate = 0` e SEM
 * override de categoria: o catálogo (Milestone 13) ainda não existe neste
 * ponto do onboarding (o passo de categorias vem depois do passo fiscal no
 * wizard), então não há `category_id` para vincular a alíquota de IPI que o
 * usuário digitou no passo 2. É o mesmo estado do briefing §6 — "existe,
 * mas não incide por omissão" — até a organização criar o override de
 * categoria em /settings (Milestone 10, já existe a tela).
 */
/** Converte "18,00" (formato do campo do wizard) em 18. "" ou inválido vira 0. */
export function parseBrRate(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildTaxTemplatePlan(input: TaxTemplateInput): TaxTemplatePlan {
  switch (input.templateId) {
    case "simples":
      return {
        taxTypes: [],
        settings: { documentFooter: input.footerText || null, showTaxLines: false },
      };
    case "isento":
      return {
        taxTypes: [],
        settings: { documentFooter: null, showTaxLines: false },
      };
    case "icms-ipi":
      return {
        taxTypes: [
          {
            code: "ICMS",
            label: "ICMS",
            mode: "exclusive",
            defaultRate: input.icmsRate,
            displayOrder: 1,
          },
          { code: "IPI", label: "IPI", mode: "inclusive", defaultRate: 0, displayOrder: 2 },
        ],
        settings: { documentFooter: null, showTaxLines: true },
      };
  }
}
