import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseSpreadsheet, validateImportRows } from "@/lib/catalog/import";

/**
 * Espelha os casos de erro que a UI do Milestone 6 já demonstrava em
 * lib/catalog/mock-data.ts (removidos dali quando a importação passou a
 * parsear planilha de verdade) — cada regra de validação do PLAN.md
 * (Milestone 13) tem um caso aqui.
 */

function xlsxBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function csvBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("parseSpreadsheet", () => {
  it("lê um .xlsx binário real (não array simulado)", () => {
    const matrix = parseSpreadsheet(
      xlsxBuffer([
        ["Código", "Nome", "Preço", "Estoque", "Categoria"],
        ["PRD-001", "Cimento CP-II 50kg", "34,90", 320, "Acabamento"],
      ]),
    );
    expect(matrix[1]).toEqual(["PRD-001", "Cimento CP-II 50kg", "34,90", "320", "Acabamento"]);
  });

  it("preserva acentuação de .csv sem BOM (Excel PT-BR não grava BOM por padrão)", () => {
    const matrix = parseSpreadsheet(
      csvBuffer("Código;Nome;Preço;Estoque;Categoria\nPRD-100;Solução completa;10,00;5;Acabamento"),
    );
    expect(matrix[0]).toEqual(["Código", "Nome", "Preço", "Estoque", "Categoria"]);
    expect(matrix[1][1]).toBe("Solução completa");
  });

  it("lê .csv com ; (delimitador que o Excel PT-BR usa por causa da vírgula decimal)", () => {
    const matrix = parseSpreadsheet(
      csvBuffer("Código;Nome;Preço;Estoque;Categoria\nPRD-900;Furadeira;289,90;14;Ferramentas"),
    );
    expect(matrix[1]).toEqual(["PRD-900", "Furadeira", "289,90", "14", "Ferramentas"]);
  });
});

const header = ["Código", "Nome", "Preço", "Estoque", "Categoria"];

describe("validateImportRows", () => {
  it("marca linha ok quando todos os campos são válidos", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-001", "Cimento CP-II 50kg", "R$ 34,90", "320", "Acabamento"],
    ]);
    expect(rows).toEqual([
      {
        row: 2,
        externalCode: "PRD-001",
        name: "Cimento CP-II 50kg",
        price: "R$ 34,90",
        stock: "320",
        category: "Acabamento",
        status: "ok",
      },
    ]);
  });

  it("ignora linha totalmente vazia sem virar linha de preview", () => {
    const { rows, ignoredEmptyRowCount } = validateImportRows([
      header,
      ["PRD-001", "Cimento CP-II 50kg", "R$ 34,90", "320", "Acabamento"],
      ["", "", "", "", ""],
    ]);
    expect(rows).toHaveLength(1);
    expect(ignoredEmptyRowCount).toBe(1);
  });

  it("erro: código externo obrigatório", () => {
    const { rows } = validateImportRows([
      header,
      ["", "Tijolo baiano 9 furos", "R$ 1,20", "2000", "Acabamento"],
    ]);
    expect(rows[0]).toMatchObject({ status: "erro", error: "Código externo obrigatório." });
  });

  it("erro: nome do produto obrigatório", () => {
    const { rows } = validateImportRows([header, ["PRD-042", "", "R$ 15,00", "80", "Ferramentas"]]);
    expect(rows[0]).toMatchObject({ status: "erro", error: "Nome do produto obrigatório." });
  });

  it("erro: preço obrigatório", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-043", "Chuveiro elétrico 127V", "", "12", "Material elétrico"],
    ]);
    expect(rows[0]).toMatchObject({ status: "erro", error: "Preço obrigatório." });
  });

  it("erro: preço mal formatado", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-041", "Telha cerâmica", "trinta reais", "60", "Acabamento"],
    ]);
    expect(rows[0]).toMatchObject({
      status: "erro",
      error: "Preço mal formatado — use vírgula para centavos (ex.: 12,50).",
    });
  });

  it("aceita preço BR com milhar (ponto) e centavos (vírgula)", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-050", "Telha cerâmica", "1.250,00", "60", "Acabamento"],
    ]);
    expect(rows[0].status).toBe("ok");
  });

  it("aceita preço inteiro sem separador decimal", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-051", "Vergalhão 10mm 12m", "58", "96", "Ferramentas"],
    ]);
    expect(rows[0].status).toBe("ok");
  });

  it("erro: estoque inválido (negativo ou não numérico)", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-060", "Produto qualquer", "R$ 10,00", "-5", "Ferramentas"],
    ]);
    expect(rows[0]).toMatchObject({
      status: "erro",
      error: "Estoque inválido — use um número inteiro maior ou igual a zero.",
    });
  });

  it("erro: código externo duplicado na planilha marca todas as ocorrências exceto a última", () => {
    const { rows } = validateImportRows([
      header,
      ["PRD-003", "Vergalhão 10mm 12m", "R$ 58,00", "96", "Ferramentas"],
      ["PRD-003", "Vergalhão 10mm 12m (revisado)", "R$ 60,00", "90", "Ferramentas"],
    ]);
    expect(rows[0]).toMatchObject({ status: "erro" });
    expect(rows[0].error).toMatch(/duplicado/i);
    expect(rows[1].status).toBe("ok");
  });

  it("código duplicado é case-insensitive", () => {
    const { rows } = validateImportRows([
      header,
      ["prd-070", "Produto A", "R$ 10,00", "5", "Ferramentas"],
      ["PRD-070", "Produto A (dup)", "R$ 12,00", "3", "Ferramentas"],
    ]);
    expect(rows[0].status).toBe("erro");
    expect(rows[1].status).toBe("ok");
  });

  it("linhas em branco não contam como código duplicado entre si", () => {
    const { rows, ignoredEmptyRowCount } = validateImportRows([
      header,
      ["", "", "", "", ""],
      ["", "", "", "", ""],
    ]);
    expect(rows).toHaveLength(0);
    expect(ignoredEmptyRowCount).toBe(2);
  });
});
