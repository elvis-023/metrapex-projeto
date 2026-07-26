import * as XLSX from "xlsx";

import { parseBrPrice, parseStockValue } from "@/lib/catalog/money";
import type { ProductImportRow } from "@/lib/catalog/types";

/**
 * Lê .csv e .xlsx pelo mesmo caminho — o SheetJS detecta o formato pelo
 * conteúdo do buffer, então não precisamos ramificar por extensão de arquivo.
 */
export function parseSpreadsheet(buffer: ArrayBuffer): string[][] {
  // `codepage: 65001` (UTF-8) — sem isso, um .csv sem BOM (comum: Excel/Sheets
  // no Windows em pt-BR não grava BOM por padrão) vem com "Código"/"Preço"
  // corrompido em mojibake. Não afeta .xlsx binário, que já é UTF-8 interno.
  const workbook = XLSX.read(buffer, { type: "array", codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
}

export type ImportValidationResult = {
  rows: ProductImportRow[];
  ignoredEmptyRowCount: number;
};

/**
 * Valida linha a linha (pula o cabeçalho na linha 1). Colunas esperadas, na
 * ordem: código externo, nome, preço, estoque, categoria — mesma ordem da
 * pré-visualização em product-import-wizard.tsx.
 */
export function validateImportRows(matrix: string[][]): ImportValidationResult {
  const dataRows = matrix.slice(1);
  const rows: ProductImportRow[] = [];
  let ignoredEmptyRowCount = 0;

  // externalCode (minúsculo) -> índice em `rows` da última ocorrência vista.
  const lastSeenAt = new Map<string, number>();

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const [externalCode = "", name = "", price = "", stock = "", category = ""] = cells.map(
      (cell) => (cell ?? "").toString().trim(),
    );

    if (!externalCode && !name && !price && !stock && !category) {
      ignoredEmptyRowCount += 1;
      return;
    }

    const row: ProductImportRow = {
      row: rowNumber,
      externalCode,
      name,
      price,
      stock,
      category,
      status: "ok",
    };

    if (!externalCode) {
      row.status = "erro";
      row.error = "Código externo obrigatório.";
    } else if (!name) {
      row.status = "erro";
      row.error = "Nome do produto obrigatório.";
    } else if (!price) {
      row.status = "erro";
      row.error = "Preço obrigatório.";
    } else if (parseBrPrice(price) === null) {
      row.status = "erro";
      row.error = "Preço mal formatado — use vírgula para centavos (ex.: 12,50).";
    } else if (!stock) {
      row.status = "erro";
      row.error = "Estoque obrigatório.";
    } else if (parseStockValue(stock) === null) {
      row.status = "erro";
      row.error = "Estoque inválido — use um número inteiro maior ou igual a zero.";
    }

    rows.push(row);

    if (externalCode) {
      const key = externalCode.toLowerCase();
      const previousIndex = lastSeenAt.get(key);
      if (previousIndex !== undefined) {
        rows[previousIndex] = {
          ...rows[previousIndex],
          status: "erro",
          error: `Código externo duplicado na planilha (repetido na linha ${rowNumber}).`,
        };
      }
      lastSeenAt.set(key, rows.length - 1);
    }
  });

  return { rows, ignoredEmptyRowCount };
}
