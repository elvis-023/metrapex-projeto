"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Salesperson } from "@/lib/pipeline/mock-data";

export const ALL_SALESPEOPLE = "all";

export function PipelineFilters({
  salespeople,
  assigneeId,
  onAssigneeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  salespeople: Salesperson[];
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  const nameById = new Map(salespeople.map((person) => [person.id, person.name]));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={assigneeId}
        onValueChange={(value) => onAssigneeChange(value ?? ALL_SALESPEOPLE)}
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

      {/* Filtra por data de CRIAÇÃO do orçamento, não de validade — `expires_at`
          é opcional (rascunho sem prazo definido) e ficaria fora de qualquer
          filtro por período; `created_at` sempre existe e reflete quando o
          orçamento entrou no funil. */}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="Criado a partir de"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="w-[9.5rem]"
        />
        <span className="text-muted-foreground text-xs">até</span>
        <Input
          type="date"
          aria-label="Criado até"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(event) => onDateToChange(event.target.value)}
          className="w-[9.5rem]"
        />
      </div>
    </div>
  );
}
