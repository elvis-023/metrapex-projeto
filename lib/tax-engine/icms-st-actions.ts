"use server";

import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { IcmsStStateRule, IcmsStStateRuleInput } from "@/lib/tax-engine/icms-st-types";

type IcmsStStateRuleRow = Database["public"]["Tables"]["icms_st_state_rules"]["Row"];

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

/** Campos editáveis — category_id/uf são identidade do registro, nunca mudam por update (ver lib/supabase/types.ts). */
function toEditableRow(input: IcmsStStateRuleInput) {
  return {
    icms_contribuinte_rate: input.icmsContribuinteRate,
    icms_nao_contribuinte_rate: input.icmsNaoContribuinteRate,
    icms_reducao_base: input.icmsReducaoBase,
    st_contribuinte_rate: input.stContribuinteRate,
    st_nao_contribuinte_rate: input.stNaoContribuinteRate,
    iva_simples: input.ivaSimples,
    iva_normal: input.ivaNormal,
    fcp_comercializacao: input.fcpComercializacao,
    fcp_consumo: input.fcpConsumo,
    fcp_st_comercializacao: input.fcpStComercializacao,
    fcp_st_consumo: input.fcpStConsumo,
    cst_comercializacao: input.cstComercializacao,
    cst_consumo: input.cstConsumo,
    codigo_beneficio: input.codigoBeneficio,
    decreto_contribuinte: input.decretoContribuinte,
    decreto_nao_contribuinte: input.decretoNaoContribuinte,
    note: input.note,
  };
}

function toResult(data: IcmsStStateRuleRow): IcmsStStateRule {
  return {
    id: data.id,
    categoryId: data.category_id,
    uf: data.uf,
    icmsContribuinteRate: data.icms_contribuinte_rate,
    icmsNaoContribuinteRate: data.icms_nao_contribuinte_rate,
    icmsReducaoBase: data.icms_reducao_base,
    stContribuinteRate: data.st_contribuinte_rate,
    stNaoContribuinteRate: data.st_nao_contribuinte_rate,
    ivaSimples: data.iva_simples,
    ivaNormal: data.iva_normal,
    fcpComercializacao: data.fcp_comercializacao,
    fcpConsumo: data.fcp_consumo,
    fcpStComercializacao: data.fcp_st_comercializacao,
    fcpStConsumo: data.fcp_st_consumo,
    cstComercializacao: data.cst_comercializacao,
    cstConsumo: data.cst_consumo,
    codigoBeneficio: data.codigo_beneficio,
    decretoContribuinte: data.decreto_contribuinte,
    decretoNaoContribuinte: data.decreto_nao_contribuinte,
    note: data.note,
  };
}

export async function createIcmsStStateRuleAction(
  input: IcmsStStateRuleInput,
): Promise<IcmsStStateRule> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("icms_st_state_rules")
    .insert({
      org_id: org.id,
      category_id: input.categoryId,
      uf: input.uf,
      ...toEditableRow(input),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Já existe uma regra desta categoria para esta UF.");
    }
    throw new Error("Não foi possível criar a regra de ICMS-ST.");
  }
  return toResult(data);
}

export async function updateIcmsStStateRuleAction(
  id: string,
  input: IcmsStStateRuleInput,
): Promise<IcmsStStateRule> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("icms_st_state_rules")
    .update(toEditableRow(input))
    .eq("id", id)
    .eq("org_id", org.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Não foi possível atualizar a regra de ICMS-ST.");
  }
  return toResult(data);
}

export async function deleteIcmsStStateRuleAction(id: string): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("icms_st_state_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) throw new Error("Não foi possível excluir a regra de ICMS-ST.");
}
