import type { TaxMode } from "@/lib/tax-engine/types";

export type TaxTemplateId = "simples" | "isento" | "icms-ipi" | "lucro-real";

/**
 * Regime Tributário (briefing §6) — metadado da organização, nunca lido por
 * resolveRate/calcTax (decisão registrada em
 * .claude/skills/decisao-pendente/references/decisoes-registradas.md, "Regime
 * Tributário" #1). Mesmos 4 valores do `check` de `organizations.tax_regime`
 * (migration 20260801000017_tax_regime.sql).
 */
export type TaxRegime = "mei" | "simples_nacional" | "lucro_presumido" | "lucro_real";

export const TAX_REGIMES: readonly TaxRegime[] = [
  "mei",
  "simples_nacional",
  "lucro_presumido",
  "lucro_real",
];

/** Rótulo legível — única fonte, reaproveitada pelo onboarding e pela tela de configurações. */
export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  mei: "MEI",
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

/**
 * Validação de regime é camada de serviço, acima do motor — não um branch
 * dentro de resolveRate/calcTax (nenhum dos dois recebe regime como
 * parâmetro). Chame antes de gravar `organizations.tax_regime`, para devolver
 * mensagem amigável em vez do erro cru do `check` do banco.
 */
export function isValidTaxRegime(value: string): value is TaxRegime {
  return (TAX_REGIMES as readonly string[]).includes(value);
}

/**
 * Regime -> preset de onboarding (decisão registrada, "Regime Tributário" #2).
 * MEI e Simples Nacional convergem no preset "simples" (nenhum tax_type, só
 * rodapé); Lucro Presumido usa "icms-ipi"; Lucro Real tem entrada própria
 * ("lucro-real") em buildTaxTemplatePlan, não um alias de "icms-ipi" — os dois
 * só coincidem por acaso no V1 e podem divergir quando PIS/COFINS
 * não-cumulativo entrar em escopo (briefing §8, §10).
 */
export function templateIdForRegime(regime: TaxRegime): TaxTemplateId {
  switch (regime) {
    case "mei":
    case "simples_nacional":
      return "simples";
    case "lucro_presumido":
      return "icms-ipi";
    case "lucro_real":
      return "lucro-real";
  }
}

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
    // Lucro Real: mesmo conteúdo inicial do "icms-ipi" hoje, mas entrada
    // própria de propósito (não um `case "icms-ipi": case "lucro-real":`
    // compartilhado) — ver decisão registrada citada acima do arquivo.
    case "lucro-real":
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
