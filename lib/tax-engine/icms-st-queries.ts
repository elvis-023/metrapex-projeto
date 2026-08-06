import { getCurrentOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { IcmsStStateRule } from "@/lib/tax-engine/icms-st-types";

type IcmsStStateRuleRow = Database["public"]["Tables"]["icms_st_state_rules"]["Row"];

function toIcmsStStateRule(row: IcmsStStateRuleRow): IcmsStStateRule {
  return {
    id: row.id,
    categoryId: row.category_id,
    uf: row.uf,
    icmsContribuinteRate: row.icms_contribuinte_rate,
    icmsNaoContribuinteRate: row.icms_nao_contribuinte_rate,
    icmsReducaoBase: row.icms_reducao_base,
    stContribuinteRate: row.st_contribuinte_rate,
    stNaoContribuinteRate: row.st_nao_contribuinte_rate,
    ivaSimples: row.iva_simples,
    ivaNormal: row.iva_normal,
    fcpComercializacao: row.fcp_comercializacao,
    fcpConsumo: row.fcp_consumo,
    fcpStComercializacao: row.fcp_st_comercializacao,
    fcpStConsumo: row.fcp_st_consumo,
    cstComercializacao: row.cst_comercializacao,
    cstConsumo: row.cst_consumo,
    codigoBeneficio: row.codigo_beneficio,
    decretoContribuinte: row.decreto_contribuinte,
    decretoNaoContribuinte: row.decreto_nao_contribuinte,
    note: row.note,
  };
}

/** Todas as regras de ICMS-ST de uma categoria — a tela agrupa por UF (grid de 27). */
export async function getIcmsStStateRules(categoryId: string): Promise<IcmsStStateRule[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("icms_st_state_rules")
    .select("*")
    .eq("org_id", org.id)
    .eq("category_id", categoryId)
    .order("uf");

  if (error || !data) return [];
  return data.map(toIcmsStStateRule);
}

/**
 * Todas as regras de ICMS-ST da organização, de todas as categorias — a
 * tela (`/settings/taxes/icms-st`) busca uma vez e troca de categoria só
 * filtrando no client, sem round-trip novo ao servidor a cada seleção.
 */
export async function getIcmsStStateRulesByOrg(): Promise<IcmsStStateRule[]> {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("icms_st_state_rules")
    .select("*")
    .eq("org_id", org.id)
    .order("category_id")
    .order("uf");

  if (error || !data) return [];
  return data.map(toIcmsStStateRule);
}
