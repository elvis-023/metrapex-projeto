"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pipelineStages, type Salesperson } from "@/lib/pipeline/mock-data";

export const ALL_STATUSES = "all";
export const ALL_SALESPEOPLE = "all";

const statusLabelByValue = new Map<string, string>(
  pipelineStages.map((stage) => [stage.status, stage.label]),
);

export function QuoteListFilters({
  q,
  status,
  ownerId,
  dateFrom,
  dateTo,
  salespeople,
}: {
  q: string;
  status: string;
  ownerId: string;
  dateFrom: string;
  dateTo: string;
  salespeople: Salesperson[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nameById = new Map(salespeople.map((person) => [person.id, person.name]));

  function updateQuery(key: string, value: string, fallback: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== fallback) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/quotes?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative sm:max-w-xs">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          defaultValue={q}
          placeholder="Buscar por número ou cliente"
          className="pl-8"
          onChange={(event) => updateQuery("q", event.target.value, "")}
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => updateQuery("status", value ?? ALL_STATUSES, ALL_STATUSES)}
      >
        <SelectTrigger aria-label="Filtrar por status" className="sm:w-44">
          <SelectValue>
            {(value: string) =>
              value === ALL_STATUSES ? "Todos os status" : (statusLabelByValue.get(value) ?? "—")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>Todos os status</SelectItem>
          {pipelineStages.map((stage) => (
            <SelectItem key={stage.status} value={stage.status}>
              {stage.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={ownerId}
        onValueChange={(value) => updateQuery("ownerId", value ?? ALL_SALESPEOPLE, ALL_SALESPEOPLE)}
      >
        <SelectTrigger aria-label="Filtrar por vendedor" className="sm:w-56">
          <SelectValue>
            {(value: string) =>
              value === ALL_SALESPEOPLE ? "Todos os vendedores" : (nameById.get(value) ?? "—")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SALESPEOPLE}>Todos os vendedores</SelectItem>
          {salespeople.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtra por data de CRIAÇÃO do orçamento, não de validade — mesma
          escolha e mesmo motivo do filtro de período do board do Pipeline
          (`expires_at` é nullable em rascunho; `created_at` sempre existe). */}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="Criado a partir de"
          defaultValue={dateFrom}
          max={dateTo || undefined}
          onChange={(event) => updateQuery("from", event.target.value, "")}
          className="w-[9.5rem]"
        />
        <span className="text-muted-foreground text-xs">até</span>
        <Input
          type="date"
          aria-label="Criado até"
          defaultValue={dateTo}
          min={dateFrom || undefined}
          onChange={(event) => updateQuery("to", event.target.value, "")}
          className="w-[9.5rem]"
        />
      </div>
    </div>
  );
}
