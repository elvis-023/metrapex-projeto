"use server";

import {
  buildTaxTemplatePlan,
  DEFAULT_FOOTER_TEXT,
  isValidTaxRegime,
  parseBrRate,
  templateIdForRegime,
  type TaxRegime,
  type TaxTemplateId,
} from "@/lib/tax-engine/onboarding-templates";
import { detectRegimeFromCnpj, type CnpjRegimeDetection } from "@/lib/tax-engine/regime-detection";
import type { TaxMode } from "@/lib/tax-engine/types";
import { defaultPaymentConditions, defaultPaymentValueBands } from "@/lib/quotes/payment-defaults";
import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

export type OnboardingTaxTemplateState = {
  templateId: TaxTemplateId;
  icmsRate: string;
  footerText: string;
  /**
   * Regime Tributário escolhido no passo 2 (briefing §6). Opcional por ora —
   * o wizard de onboarding (Fase 1, `lib/onboarding/`) ainda oferece os 3
   * templates antigos diretamente e não coleta regime; quando o passo 2 for
   * atualizado para perguntar o regime, ele passa a preencher este campo, e
   * `templateId` passa a ser derivado dele via `templateIdForRegime` no
   * chamador. Omitido, `organizations.tax_regime` fica `null` (§11: "regime
   * não confirmado"), sem quebrar o fluxo atual.
   */
  regime?: TaxRegime;
};

/**
 * Grava o template fiscal escolhido no passo 2 do onboarding (briefing §6).
 * Chamada por `handleFinish` logo após `createOrganizationAction` — mesma
 * transação lógica de conclusão do wizard.
 *
 * Validação de regime é camada de serviço, acima do motor: resolveRate/
 * calcTax não recebem nem leem `regime` em nenhum momento — só esta função
 * grava `organizations.tax_regime`, e só depois de validado.
 */
export async function applyTaxTemplateAction(orgId: string, state: OnboardingTaxTemplateState) {
  if (state.regime !== undefined && !isValidTaxRegime(state.regime)) {
    throw new Error(`Regime tributário inválido: "${state.regime}".`);
  }

  const plan = buildTaxTemplatePlan({
    templateId: state.templateId,
    icmsRate: parseBrRate(state.icmsRate),
    footerText: state.footerText,
  });
  const supabase = await createClient();

  if (state.regime !== undefined) {
    const { error: regimeError } = await supabase
      .from("organizations")
      .update({ tax_regime: state.regime })
      .eq("id", orgId);
    if (regimeError) {
      throw new Error("Não foi possível gravar o regime tributário.");
    }
  }

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
 * Detecção automática de regime a partir do CNPJ do passo 1 (Bloco 7,
 * decisão "Regime Tributário #4"). Roda sem `requireOrg()` — a organização
 * ainda não existe neste ponto do onboarding, mesmo caso de
 * `applyTaxTemplateAction`/`applyPaymentDefaultsAction` abaixo.
 *
 * Wrapper fino sobre `detectRegimeFromCnpj` (lib/tax-engine/regime-detection.ts)
 * — só existe porque uma Server Action precisa do próprio arquivo `"use
 * server"`, o cache/timeout/tri-estado de verdade vive lá. O gatilho que
 * chama esta action a partir do campo de texto do passo 1 é o Bloco 8.
 */
export async function detectTaxRegimeFromCnpjAction(
  cnpjDigits: string,
): Promise<CnpjRegimeDetection> {
  return detectRegimeFromCnpj(cnpjDigits);
}

/**
 * Grava as condições de pagamento e faixas de valor marcadas no passo 3 do
 * onboarding (checkbox, não mais seleção única — Bloco "condições
 * selecionáveis"). `selectedConditionKeys` são as `key` de
 * `defaultPaymentConditions` (mesmo valor que `PaymentConditionOption.id` em
 * lib/onboarding/mock-data.ts) que o cliente deixou marcadas; só essas são
 * gravadas — nunca confia só na validação do client (`isStepValid` já exige
 * pelo menos uma), então recusa lista vazia aqui também.
 *
 * A partir daqui o motor de orçamento tem o que aplicar no cálculo — sem
 * nenhuma condição configurada, o orçamento sai sem desconto de pagamento e
 * sem restrição de faixa.
 */
export async function applyPaymentDefaultsAction(orgId: string, selectedConditionKeys: string[]) {
  if (selectedConditionKeys.length === 0) {
    throw new Error("Selecione ao menos uma condição de pagamento.");
  }

  const selectedConditions = defaultPaymentConditions.filter((condition) =>
    selectedConditionKeys.includes(condition.key),
  );

  const supabase = await createClient();

  const { data: conditions, error: conditionsError } = await supabase
    .from("payment_conditions")
    .insert(
      selectedConditions.map((condition) => ({
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
    selectedConditions.map((seed) => [
      seed.key,
      conditions.find((row) => row.label === seed.label)?.id,
    ]),
  );

  for (const band of defaultPaymentValueBands) {
    const links = band.conditionKeys
      .map((key) => idByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((id) => ({ payment_condition_id: id }));

    // Faixa cujas condições foram todas desmarcadas fica sem sentido (mesma
    // regra de validação da tela de Configurações — banda precisa de ao
    // menos uma condição) — pula em vez de gravar uma faixa vazia.
    if (links.length === 0) continue;

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

    const { error: linkError } = await supabase
      .from("payment_band_conditions")
      .insert(links.map((link) => ({ ...link, band_id: bandRow.id })));
    if (linkError) {
      throw new Error("Não foi possível vincular as condições às faixas de valor.");
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD real da tela de configuração de impostos (Milestone 10). Toda escrita
// resolve a organização pela sessão (`requireOrg`) — nunca por um org_id vindo
// do client (CLAUDE.md). resolveRate/calcTax continuam sem tocar nada disto:
// estas funções só gravam tax_types/tax_rates/tax_settings, o mesmo caminho
// que o motor já lê em lib/quotes/queries.ts (getTaxConfiguration).
// ---------------------------------------------------------------------------

export type TaxTypeInput = {
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;
};

export type TaxTypeResult = {
  id: string;
  code: string;
  label: string;
  mode: TaxMode;
  defaultRate: number;
};

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function createTaxTypeAction(input: TaxTypeInput): Promise<TaxTypeResult> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_types")
    .insert({
      org_id: org.id,
      code: input.code.trim(),
      label: input.label.trim(),
      mode: input.mode,
      default_rate: input.defaultRate,
    })
    .select("id, code, label, mode, default_rate")
    .single();

  if (error || !data) {
    throw new Error(
      isUniqueViolation(error)
        ? "Já existe um tributo com esse código."
        : "Não foi possível criar o tributo.",
    );
  }
  return {
    id: data.id,
    code: data.code,
    label: data.label,
    mode: data.mode,
    defaultRate: Number(data.default_rate),
  };
}

export async function updateTaxTypeAction(id: string, input: TaxTypeInput): Promise<TaxTypeResult> {
  await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_types")
    .update({
      code: input.code.trim(),
      label: input.label.trim(),
      mode: input.mode,
      default_rate: input.defaultRate,
    })
    .eq("id", id)
    .select("id, code, label, mode, default_rate")
    .single();

  if (error || !data) {
    throw new Error(
      isUniqueViolation(error)
        ? "Já existe um tributo com esse código."
        : "Não foi possível atualizar o tributo.",
    );
  }
  return {
    id: data.id,
    code: data.code,
    label: data.label,
    mode: data.mode,
    defaultRate: Number(data.default_rate),
  };
}

/**
 * Mesmo guard de `deleteCategoryAction` (lib/catalog/actions.ts): a UI já
 * bloqueia excluir tributo com override pendente, mas a regra tem que existir
 * no servidor também — nunca confiar só na validação do client.
 */
export async function deleteTaxTypeAction(id: string): Promise<void> {
  await requireOrg();
  const supabase = await createClient();

  const { count } = await supabase
    .from("tax_rates")
    .select("id", { count: "exact", head: true })
    .eq("tax_type_id", id);
  if (count && count > 0) {
    throw new Error(`Remova o(s) ${count} override(s) deste tributo antes de excluí-lo.`);
  }

  const { error } = await supabase.from("tax_types").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o tributo.");
}

export type TaxRateOverrideInput = {
  taxTypeId: string;
  scope: "category" | "product";
  categoryId: string | null;
  productId: string | null;
  rate: number;
  note: string | null;
};

export type TaxRateOverrideResult = {
  id: string;
  taxTypeId: string;
  scope: "category" | "product";
  categoryId: string | null;
  productId: string | null;
  rate: number;
  note: string | null;
};

function overrideRow(input: TaxRateOverrideInput) {
  if (input.scope === "category" && !input.categoryId) {
    throw new Error("Selecione uma categoria.");
  }
  if (input.scope === "product" && !input.productId) {
    throw new Error("Selecione um produto.");
  }
  return {
    tax_type_id: input.taxTypeId,
    category_id: input.scope === "category" ? input.categoryId : null,
    product_id: input.scope === "product" ? input.productId : null,
    rate: input.rate,
    note: input.note,
  };
}

function toOverrideResult(row: {
  id: string;
  tax_type_id: string;
  category_id: string | null;
  product_id: string | null;
  rate: number | string;
  note: string | null;
}): TaxRateOverrideResult {
  return {
    id: row.id,
    taxTypeId: row.tax_type_id,
    scope: row.category_id ? "category" : "product",
    categoryId: row.category_id,
    productId: row.product_id,
    rate: Number(row.rate),
    note: row.note,
  };
}

export async function createTaxRateOverrideAction(
  input: TaxRateOverrideInput,
): Promise<TaxRateOverrideResult> {
  await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_rates")
    .insert(overrideRow(input))
    .select("id, tax_type_id, category_id, product_id, rate, note")
    .single();

  if (error || !data) {
    throw new Error(
      isUniqueViolation(error)
        ? "Já existe um override deste tributo para esse escopo."
        : "Não foi possível criar o override.",
    );
  }
  return toOverrideResult(data);
}

/**
 * Só `rate`/`note` são editáveis (mesma restrição já existente no tipo
 * gerado de `tax_rates.Update`, lib/supabase/types.ts) — tributo, categoria e
 * produto são a IDENTIDADE do override (é o que os índices únicos
 * `tax_rates_uniq_category`/`tax_rates_uniq_product` protegem). Trocar de
 * escopo é excluir e criar de novo, não editar em cima.
 */
export type TaxRateOverrideRateInput = { rate: number; note: string | null };

export async function updateTaxRateOverrideAction(
  id: string,
  input: TaxRateOverrideRateInput,
): Promise<TaxRateOverrideResult> {
  await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_rates")
    .update({ rate: input.rate, note: input.note })
    .eq("id", id)
    .select("id, tax_type_id, category_id, product_id, rate, note")
    .single();

  if (error || !data) {
    throw new Error("Não foi possível atualizar o override.");
  }
  return toOverrideResult(data);
}

export async function deleteTaxRateOverrideAction(id: string): Promise<void> {
  await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase.from("tax_rates").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o override.");
}

export type TaxSettingsInput = {
  documentFooter: string | null;
  showTaxLines: boolean;
};

export async function updateTaxSettingsAction(input: TaxSettingsInput): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.from("tax_settings").upsert(
    {
      org_id: org.id,
      document_footer: input.documentFooter,
      show_tax_lines: input.showTaxLines,
    },
    { onConflict: "org_id" },
  );
  if (error) throw new Error("Não foi possível salvar a configuração do rodapé.");
}

// ---------------------------------------------------------------------------
// Regime Tributário pós-onboarding (briefing §6, decisão registrada em
// decisoes-registradas.md, "Regime Tributário" #3): trocar o regime é SEMPRE
// uma escrita de metadado isolada — nunca toca tax_types/tax_rates/
// tax_settings na mesma ação. Reaplicar o preset padrão é uma ação separada,
// opt-in, chamada só depois de o usuário confirmar a prévia na tela — nunca
// automática ao trocar o select.
// ---------------------------------------------------------------------------

export async function updateOrganizationRegimeAction(regime: TaxRegime): Promise<void> {
  if (!isValidTaxRegime(regime)) {
    throw new Error(`Regime tributário inválido: "${regime}".`);
  }
  const org = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ tax_regime: regime })
    .eq("id", org.id);
  if (error) throw new Error("Não foi possível gravar o regime tributário.");
}

/**
 * Substitui a configuração fiscal ATUAL da organização pelo preset do regime
 * informado — apaga tax_rates/tax_types/tax_settings existentes e insere o
 * preset (mesmo `buildTaxTemplatePlan` do onboarding). Só chamada depois de
 * confirmação explícita na UI, que mostra a mesma prévia antes de o usuário
 * confirmar — nunca dispara sozinha ao trocar `tax_regime`.
 *
 * Não toca `quotes`/`quote_items`/`quote_item_taxes` em nenhum momento —
 * mesmo invariante do reset do Bloco 1 (briefing §3): documento emitido é
 * fotografia, nunca lê `tax_types`/`tax_rates` de novo.
 */
export type ApplyRegimeTemplateResult = {
  taxTypes: TaxTypeResult[];
  documentFooter: string | null;
  showTaxLines: boolean;
};

export async function applyRegimeTemplateAction(
  regime: TaxRegime,
  icmsRate: string,
): Promise<ApplyRegimeTemplateResult> {
  if (!isValidTaxRegime(regime)) {
    throw new Error(`Regime tributário inválido: "${regime}".`);
  }
  const org = await requireOrg();
  const templateId = templateIdForRegime(regime);
  const plan = buildTaxTemplatePlan({
    templateId,
    icmsRate: parseBrRate(icmsRate),
    footerText: regime === "mei" || regime === "simples_nacional" ? DEFAULT_FOOTER_TEXT : "",
  });
  const supabase = await createClient();

  const { data: existingTypes } = await supabase
    .from("tax_types")
    .select("id")
    .eq("org_id", org.id);
  const existingIds = (existingTypes ?? []).map((t) => t.id);
  if (existingIds.length > 0) {
    const { error: deleteRatesError } = await supabase
      .from("tax_rates")
      .delete()
      .in("tax_type_id", existingIds);
    if (deleteRatesError) throw new Error("Não foi possível limpar os overrides atuais.");
  }

  const { error: deleteTypesError } = await supabase
    .from("tax_types")
    .delete()
    .eq("org_id", org.id);
  if (deleteTypesError) throw new Error("Não foi possível limpar os tributos atuais.");

  const { error: deleteSettingsError } = await supabase
    .from("tax_settings")
    .delete()
    .eq("org_id", org.id);
  if (deleteSettingsError) throw new Error("Não foi possível limpar a configuração atual.");

  const { error: settingsError } = await supabase.from("tax_settings").insert({
    org_id: org.id,
    document_footer: plan.settings.documentFooter,
    show_tax_lines: plan.settings.showTaxLines,
  });
  if (settingsError) throw new Error("Não foi possível aplicar o preset do regime.");

  let insertedTypes: TaxTypeResult[] = [];
  if (plan.taxTypes.length > 0) {
    const { data: inserted, error: taxTypesError } = await supabase
      .from("tax_types")
      .insert(
        plan.taxTypes.map((taxType) => ({
          org_id: org.id,
          code: taxType.code,
          label: taxType.label,
          mode: taxType.mode,
          default_rate: taxType.defaultRate,
          display_order: taxType.displayOrder,
        })),
      )
      .select("id, code, label, mode, default_rate")
      .order("display_order");
    if (taxTypesError || !inserted)
      throw new Error("Não foi possível aplicar os tributos do preset.");
    insertedTypes = inserted.map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      mode: row.mode,
      defaultRate: Number(row.default_rate),
    }));
  }

  return {
    taxTypes: insertedTypes,
    documentFooter: plan.settings.documentFooter,
    showTaxLines: plan.settings.showTaxLines,
  };
}
