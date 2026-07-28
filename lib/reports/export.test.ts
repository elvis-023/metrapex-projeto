import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { csvToBase64, rowsToCsv, rowsToXlsxBase64, type ExportColumn } from "@/lib/reports/export";

type Row = { name: string; total: number };

const columns: ExportColumn<Row>[] = [
  { header: "Nome", value: (row) => row.name },
  { header: "Total", value: (row) => row.total },
];

describe("rowsToCsv", () => {
  it("gera cabeçalho e linhas separados por ponto e vírgula", () => {
    const csv = rowsToCsv<Row>([{ name: "Cliente A", total: 100 }], columns);
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("Nome;Total");
    expect(lines[1]).toBe("Cliente A;100");
  });

  it("começa com BOM UTF-8, para o Excel no Windows não corromper acento", () => {
    const csv = rowsToCsv<Row>([{ name: "Ração", total: 1 }], columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("escapa valor com ponto e vírgula ou aspas (delimitador real do CSV pt-BR)", () => {
    const csv = rowsToCsv<Row>([{ name: 'Cliente "Especial"; VIP', total: 1 }], columns);
    expect(csv).toContain('"Cliente ""Especial""; VIP"');
  });

  it("NÃO escapa vírgula solta — delimitador é ';', vírgula é decimal pt-BR sem ambiguidade", () => {
    // Achado ao abrir a exportação de verdade no Excel brasileiro: citar um
    // valor como "R$ 1.234,56" ou "2,5" faz o Excel importar como TEXTO em
    // vez de número/moeda — só cita quando há risco real de ambiguidade com
    // o delimitador (';'), aspas ou quebra de linha.
    const csv = rowsToCsv<Row>([{ name: "R$ 1.234,56", total: 1 }], columns);
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[1]).toBe("R$ 1.234,56;1");
  });

  it("linha vazia produz só cabeçalho", () => {
    const csv = rowsToCsv<Row>([], columns);
    expect(csv.replace("﻿", "")).toBe("Nome;Total");
  });
});

describe("rowsToXlsxBase64", () => {
  it("produz um workbook lível com cabeçalho e dado", () => {
    const base64 = rowsToXlsxBase64<Row>([{ name: "Cliente A", total: 100 }], columns);
    const workbook = XLSX.read(base64, { type: "base64" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(rows[0]).toEqual(["Nome", "Total"]);
    expect(rows[1]).toEqual(["Cliente A", 100]);
  });
});

describe("csvToBase64", () => {
  it("decodifica de volta para o texto original", () => {
    const original = "Nome;Total\r\nCliente A;100";
    const decoded = Buffer.from(csvToBase64(original), "base64").toString("utf-8");
    expect(decoded).toBe(original);
  });
});
