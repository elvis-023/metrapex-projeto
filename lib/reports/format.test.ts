import { describe, expect, it } from "vitest";

import { bucketKey, bucketLabel, quantityFormatter } from "@/lib/reports/format";
import { bucketUnitForDays } from "@/lib/reports/types";

describe("bucketUnitForDays", () => {
  it("30 dias -> diário", () => {
    expect(bucketUnitForDays(30)).toBe("day");
  });

  it("90 dias -> semanal", () => {
    expect(bucketUnitForDays(90)).toBe("week");
  });

  it("180 dias -> semanal (limite)", () => {
    expect(bucketUnitForDays(180)).toBe("week");
  });

  it("365 dias -> mensal", () => {
    expect(bucketUnitForDays(365)).toBe("month");
  });
});

describe("bucketKey", () => {
  it("dia: usa a data em UTC, YYYY-MM-DD", () => {
    expect(bucketKey(new Date("2026-07-15T23:30:00Z"), "day")).toBe("2026-07-15");
  });

  it("semana: sempre a segunda-feira daquela semana", () => {
    // 2026-07-15 é uma quarta-feira -> segunda-feira da mesma semana é 2026-07-13.
    expect(bucketKey(new Date("2026-07-15T12:00:00Z"), "week")).toBe("2026-07-13");
    // Domingo (2026-07-19) pertence à semana que começou na segunda anterior.
    expect(bucketKey(new Date("2026-07-19T12:00:00Z"), "week")).toBe("2026-07-13");
    // A própria segunda-feira é o início da sua semana.
    expect(bucketKey(new Date("2026-07-13T00:00:00Z"), "week")).toBe("2026-07-13");
  });

  it("mês: YYYY-MM", () => {
    expect(bucketKey(new Date("2026-07-15T12:00:00Z"), "month")).toBe("2026-07");
  });
});

describe("bucketLabel", () => {
  it("dia/semana formatam como DD/MM", () => {
    expect(bucketLabel("2026-07-15", "day")).toBe("15/07");
    expect(bucketLabel("2026-07-13", "week")).toBe("13/07");
  });

  it("mês formata como mês abreviado + ano curto", () => {
    expect(bucketLabel("2026-07", "month")).toMatch(/jul/i);
  });
});

describe("quantityFormatter", () => {
  // Achado ao abrir a exportação de verdade no Excel brasileiro: um `number`
  // bruto serializa com PONTO ("2.5") — o Excel pt-BR lê isso como texto, não
  // como número. A coluna de export precisa do valor JÁ em vírgula decimal.
  it("usa vírgula como separador decimal", () => {
    expect(quantityFormatter.format(2.5)).toBe("2,5");
  });

  it("inteiro não ganha casas decimais falsas", () => {
    expect(quantityFormatter.format(10)).toBe("10");
  });

  it("preserva até 6 casas (numeric(18,6) no banco)", () => {
    expect(quantityFormatter.format(1.123456)).toBe("1,123456");
  });
});
