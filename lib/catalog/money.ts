import Decimal from "decimal.js";

/**
 * Aceita "34,90", "34.90", "34", "R$ 34,90" e "1.234,56" (milhar com ponto,
 * decimal com vírgula) — mesma tolerância usada no cadastro manual
 * (`isValidPrice` em product-form.tsx) e na importação de planilha, para as
 * duas nunca divergirem. Retorna `null` quando o valor não é um preço válido.
 */
export function parseBrPrice(raw: string): Decimal | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/^R\$\s*/i, "");
  const brThousands = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
  const simple = /^\d+([.,]\d{1,2})?$/;

  let normalized: string;
  if (brThousands.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (simple.test(cleaned)) {
    normalized = cleaned.replace(",", ".");
  } else {
    return null;
  }

  const value = new Decimal(normalized);
  return value.isFinite() ? value : null;
}

/** Estoque: inteiro maior ou igual a zero. Retorna `null` se inválido. */
export function parseStockValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}
