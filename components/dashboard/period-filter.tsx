"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardPeriodOptions, type DashboardPeriod } from "@/lib/dashboard/types";

export function PeriodFilter({ period }: { period: DashboardPeriod }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: DashboardPeriod | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams);
    params.set("period", value);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <Select value={period} onValueChange={handleChange}>
      <SelectTrigger aria-label="Filtrar período do dashboard">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {dashboardPeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
