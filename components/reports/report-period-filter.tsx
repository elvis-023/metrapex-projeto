"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportPeriodOptions, type ReportPeriod } from "@/lib/reports/types";

export function ReportPeriodFilter({
  period,
  basePath,
}: {
  period: ReportPeriod;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: ReportPeriod | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams);
    params.set("period", value);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <Select value={period} onValueChange={handleChange}>
      <SelectTrigger aria-label="Filtrar período do relatório">
        <SelectValue>
          {(value: string) => reportPeriodOptions.find((option) => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {reportPeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
