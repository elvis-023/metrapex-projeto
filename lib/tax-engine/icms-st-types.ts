/**
 * ICMS-ST por UF (briefing §8, reversão de exclusão original do V1) —
 * configuração manual, uma linha por (categoria, UF). Deliberadamente fora
 * de resolveRate/tax_rates (Bloco 1, decisão "ICMS-ST/NCM" em
 * decisoes-registradas.md): depende da UF do cliente, um dado transacional
 * que a hierarquia produto>categoria>padrão nunca conhece.
 *
 * iva_simples/iva_normal são referência/auditoria — o motor não calcula MVA
 * (§8), só resolve a alíquota final já cadastrada (stContribuinteRate/
 * stNaoContribuinteRate). cstComercializacao/cstConsumo/codigoBeneficio/
 * decretoContribuinte/decretoNaoContribuinte são metadado puro, sem uso em
 * cálculo.
 */
export type IcmsStStateRule = {
  id: string;
  categoryId: string;
  uf: string;

  icmsContribuinteRate: number;
  icmsNaoContribuinteRate: number;
  icmsReducaoBase: number;

  stContribuinteRate: number;
  stNaoContribuinteRate: number;

  ivaSimples: number | null;
  ivaNormal: number | null;

  fcpComercializacao: number;
  fcpConsumo: number;
  fcpStComercializacao: number;
  fcpStConsumo: number;

  cstComercializacao: string | null;
  cstConsumo: string | null;
  codigoBeneficio: string | null;
  decretoContribuinte: string | null;
  decretoNaoContribuinte: string | null;

  note: string | null;
};

export type IcmsStStateRuleInput = Omit<IcmsStStateRule, "id">;

/** As 27 UFs — sigla e nome, nesta ordem para exibição (alfabética por sigla). */
export const BRAZILIAN_STATES: { uf: string; name: string }[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];
