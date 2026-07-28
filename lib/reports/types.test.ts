import { describe, expect, it } from "vitest";

import { periodDays, resolveReportFilters, validateCustomReportSpec } from "@/lib/reports/types";

describe("validateCustomReportSpec", () => {
  const baseFilters = { from: "2026-01-01", to: "2026-01-31" };

  it("aceita contagem em qualquer objeto", () => {
    expect(
      validateCustomReportSpec({
        object: "customers",
        metric: "count",
        groupBy: "none",
        filters: baseFilters,
      }),
    ).toBeNull();
  });

  it("rejeita soma/média sobre clientes (sem campo monetário)", () => {
    expect(
      validateCustomReportSpec({
        object: "customers",
        metric: "sum",
        groupBy: "none",
        filters: baseFilters,
      }),
    ).not.toBeNull();
  });

  it("aceita soma sobre orçamentos", () => {
    expect(
      validateCustomReportSpec({
        object: "quotes",
        metric: "sum",
        groupBy: "status",
        filters: baseFilters,
      }),
    ).toBeNull();
  });

  it("rejeita agrupamento que não existe para o objeto", () => {
    expect(
      validateCustomReportSpec({
        object: "customers",
        metric: "count",
        groupBy: "product",
        filters: baseFilters,
      }),
    ).not.toBeNull();
  });
});

describe("resolveReportFilters", () => {
  it("from é `periodDays` dias antes de `to`", () => {
    const { from, to } = resolveReportFilters("30d");
    const days = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(days)).toBe(periodDays("30d"));
  });
});
