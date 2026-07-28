import * as XLSX from "xlsx";

/**
 * CSV/Excel de dado bruto filtrado (PLAN.md > Milestone 20). Funções puras —
 * recebem linhas já resolvidas (nomes de coluna definitivos, valores já
 * formatados como string/number), sem tocar em banco ou sessão, para poderem
 * ser testadas isoladas (mesmo motivo de `lib/quotes/engine.ts`).
 */

export type ExportColumn<T> = { header: string; value: (row: T) => string | number };

export function rowsToCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  // Delimitador é `;` (convenção pt-BR — Excel brasileiro só reconhece o CSV
  // como tabular com esse separador de lista, não vírgula). Por isso só `;`,
  // aspas e quebra de linha precisam de aspas — a vírgula é caractere comum
  // dentro de um campo (decimal de "R$ 1.234,56", "2,5") e NÃO é ambígua com
  // o delimitador real. Citar por vírgula também (versão anterior deste
  // helper) fazia o Excel abrir todo valor numérico em vírgula como TEXTO em
  // vez de número — achado ao abrir a exportação de verdade no Excel pt-BR.
  const escape = (value: string | number): string => {
    const text = String(value);
    return /["\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.map((column) => escape(column.header)).join(";");
  const lines = rows.map((row) => columns.map((column) => escape(column.value(row))).join(";"));
  // BOM UTF-8 — sem ele, Excel no Windows em pt-BR abre acento como mojibake
  // (mesmo motivo documentado em lib/catalog/import.ts para leitura, agora na escrita).
  return `﻿${[header, ...lines].join("\r\n")}`;
}

export function rowsToXlsxBase64<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const data = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Dados");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

export function csvToBase64(csv: string): string {
  return Buffer.from(csv, "utf-8").toString("base64");
}
