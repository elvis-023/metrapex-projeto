"use server";

import { revalidatePath } from "next/cache";

import { getCurrentOrganization } from "@/lib/auth/session";
import { parseSpreadsheet, validateImportRows } from "@/lib/catalog/import";
import { parseBrPrice, parseStockValue } from "@/lib/catalog/money";
import { createClient } from "@/lib/supabase/server";
import type { ProductImportRow } from "@/lib/catalog/types";

async function requireOrg() {
  const org = await getCurrentOrganization();
  if (!org) throw new Error("Não autenticado.");
  return org;
}

export type ProductActionInput = {
  externalCode: string;
  name: string;
  price: string;
  stock: string;
  categoryId: string | null;
  photoUrl: string | null;
  alternativeTitle: string;
  catalogUrl: string;
  manualUrl: string;
  videoUrl: string;
  certificateEligible: boolean;
  leadTime: string;
};

function parseProductInput(input: ProductActionInput) {
  if (!input.externalCode.trim()) throw new Error("Código externo obrigatório.");
  if (!input.name.trim()) throw new Error("Nome obrigatório.");

  const price = parseBrPrice(input.price);
  if (price === null) throw new Error("Preço mal formatado.");
  const stock = parseStockValue(input.stock);
  if (stock === null) throw new Error("Estoque inválido.");

  return {
    external_code: input.externalCode.trim(),
    name: input.name.trim(),
    // string, não `.toNumber()` — evita o bounce por float64 na serialização
    // JSON antes de chegar à coluna numeric(18,6) (convenção de dinheiro do
    // briefing §3: nunca number de ponto flutuante puro, nem de passagem).
    price: price.toFixed(6),
    stock,
    category_id: input.categoryId,
    photo_url: input.photoUrl,
    alternative_title: input.alternativeTitle,
    catalog_url: input.catalogUrl,
    manual_url: input.manualUrl,
    video_url: input.videoUrl,
    certificate_eligible: input.certificateEligible,
    lead_time: input.leadTime,
  };
}

export async function createProductAction(input: ProductActionInput): Promise<{ id: string }> {
  const org = await requireOrg();
  const values = parseProductInput(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({ org_id: org.id, ...values })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw new Error("Já existe um produto com esse código externo.");
    throw new Error("Não foi possível cadastrar o produto.");
  }

  revalidatePath("/catalog");
  return { id: data.id };
}

export async function updateProductAction(id: string, input: ProductActionInput): Promise<void> {
  const org = await requireOrg();
  const values = parseProductInput(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update(values)
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) {
    if (error.code === "23505") throw new Error("Já existe um produto com esse código externo.");
    throw new Error("Não foi possível salvar as alterações.");
  }

  revalidatePath("/catalog");
  revalidatePath(`/catalog/${id}`);
}

const NCM_PATTERN = /^[0-9]{8}$/;

function validateNcm(ncm: string): string {
  const trimmed = ncm.trim();
  if (!NCM_PATTERN.test(trimmed)) {
    throw new Error("NCM deve ter 8 dígitos.");
  }
  return trimmed;
}

export async function createCategoryAction(
  name: string,
  ncm: string,
): Promise<{ id: string; name: string; ncm: string }> {
  const org = await requireOrg();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nome da categoria obrigatório.");
  const validatedNcm = validateNcm(ncm);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .insert({ org_id: org.id, name: trimmed, ncm: validatedNcm })
    .select("id, name, ncm")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
    throw new Error("Não foi possível criar a categoria.");
  }

  revalidatePath("/catalog/categories");
  return data;
}

export async function updateCategoryAction(id: string, name: string, ncm: string): Promise<void> {
  const org = await requireOrg();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nome da categoria obrigatório.");
  const validatedNcm = validateNcm(ncm);

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_categories")
    .update({ name: trimmed, ncm: validatedNcm })
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) {
    if (error.code === "23505") throw new Error("Já existe uma categoria com esse nome.");
    throw new Error("Não foi possível atualizar a categoria.");
  }

  revalidatePath("/catalog/categories");
}

/**
 * Bloqueia a exclusão quando a categoria ainda tem produtos vinculados —
 * mesma regra que a UI já simulava. Também bloqueia quando a categoria tem
 * override de alíquota em `tax_rates` (Milestone 12): a FK dessa tabela é
 * `on delete cascade`, então excluir a categoria sem avisar apagaria a
 * configuração fiscal em silêncio — produtos futuros dessa categoria
 * passariam a herdar o padrão da organização sem que ninguém decidisse isso.
 */
export async function deleteCategoryAction(id: string): Promise<void> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("category_id", id);

  if (productCount && productCount > 0) {
    throw new Error(
      `Remova ou realoque os ${productCount} produto(s) desta categoria antes de excluí-la.`,
    );
  }

  const { count: taxRateCount } = await supabase
    .from("tax_rates")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (taxRateCount && taxRateCount > 0) {
    throw new Error(
      "Esta categoria tem uma alíquota configurada em Impostos — remova o override antes de excluí-la.",
    );
  }

  // Mesma razão do bloqueio de tax_rates acima: a FK de icms_st_state_rules
  // também é on delete cascade — excluir a categoria sem avisar apagaria a
  // configuração de ICMS-ST por UF em silêncio.
  const { count: icmsStRuleCount } = await supabase
    .from("icms_st_state_rules")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (icmsStRuleCount && icmsStRuleCount > 0) {
    throw new Error(
      "Esta categoria tem regra de ICMS-ST cadastrada — remova as regras por UF antes de excluí-la.",
    );
  }

  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) throw new Error("Não foi possível excluir a categoria.");
  revalidatePath("/catalog/categories");
}

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function uploadProductPhotoAction(formData: FormData): Promise<{ url: string }> {
  const org = await requireOrg();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Nenhum arquivo enviado.");

  const extension = ALLOWED_PHOTO_TYPES[file.type];
  if (!extension) throw new Error("Formato de imagem não suportado — use JPG, PNG ou WEBP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Imagem maior que 5MB.");

  const path = `${org.id}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("product-photos")
    .upload(path, file, { contentType: file.type });

  if (error) throw new Error("Não foi possível enviar a foto.");

  const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}

export type ImportPreview = { rows: ProductImportRow[]; ignoredEmptyRowCount: number };

export async function parseImportFileAction(formData: FormData): Promise<ImportPreview> {
  await requireOrg();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Nenhum arquivo enviado.");

  const buffer = await file.arrayBuffer();
  const matrix = parseSpreadsheet(buffer);
  return validateImportRows(matrix);
}

export type ImportCommitResult = { imported: number; failed: ProductImportRow[] };

/**
 * Confirma a importação: reaproveita `upsert_product_by_external_code` (mesma
 * função do briefing §3 usada pelo CRUD manual). A planilha guarda o NOME da
 * categoria, não o id (ver ProductImportRow) — mas desde que NCM virou
 * obrigatório por categoria (Bloco 1), categoria inexistente deixou de ser
 * criável "on the fly" aqui: a planilha não carrega NCM, e não há valor
 * seguro para inventar. Linha cuja categoria não existe na organização falha
 * com mensagem explícita, orientando cadastrar a categoria (com NCM) em
 * Categorias antes de importar.
 */
export async function commitImportAction(rows: ProductImportRow[]): Promise<ImportCommitResult> {
  const org = await requireOrg();
  const supabase = await createClient();

  const { data: existingCategories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("org_id", org.id);

  const categoryIdByName = new Map(
    (existingCategories ?? []).map((category) => [category.name.toLowerCase(), category.id]),
  );

  let imported = 0;
  const failed: ProductImportRow[] = [];

  for (const row of rows) {
    if (row.status !== "ok") continue;

    const price = parseBrPrice(row.price);
    const stock = parseStockValue(row.stock);
    if (price === null || stock === null || !row.externalCode.trim() || !row.name.trim()) {
      failed.push({ ...row, status: "erro", error: "Linha inválida ao confirmar a importação." });
      continue;
    }

    let categoryId: string | null = null;
    const categoryName = row.category.trim();
    if (categoryName) {
      const key = categoryName.toLowerCase();
      categoryId = categoryIdByName.get(key) ?? null;
      if (!categoryId) {
        failed.push({
          ...row,
          status: "erro",
          error: `Categoria "${categoryName}" não existe — cadastre-a (com NCM) em Categorias antes de importar.`,
        });
        continue;
      }
    }

    const { error } = await supabase.rpc("upsert_product_by_external_code", {
      p_org_id: org.id,
      p_external_code: row.externalCode.trim(),
      p_name: row.name.trim(),
      // string, não `.toNumber()` — mesmo motivo de parseProductInput acima.
      p_price: price.toFixed(6),
      p_stock: stock,
      p_category_id: categoryId,
    });

    if (error) {
      failed.push({ ...row, status: "erro", error: "Não foi possível salvar esta linha." });
      continue;
    }

    imported += 1;
  }

  revalidatePath("/catalog");
  revalidatePath("/catalog/categories");
  return { imported, failed };
}
