"use client";

import { useRef, type ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButtons } from "@/components/reports/export-buttons";
import type { CustomReportFilters, ExportRawObject } from "@/lib/reports/types";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ReportCard({
  title,
  description,
  exportObject,
  filters,
  children,
}: {
  title: string;
  description: string;
  exportObject?: ExportRawObject;
  filters?: CustomReportFilters;
  children: ReactNode;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <ExportButtons
          chartRef={chartRef}
          exportObject={exportObject}
          filters={filters}
          filenameHint={slugify(title)}
        />
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="bg-card">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
