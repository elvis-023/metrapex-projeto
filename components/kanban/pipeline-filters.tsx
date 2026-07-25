"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Salesperson } from "@/lib/pipeline/mock-data";

export const ALL_SALESPEOPLE = "all";

export function PipelineFilters({
  salespeople,
  assigneeId,
  onAssigneeChange,
}: {
  salespeople: Salesperson[];
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
}) {
  const nameById = new Map(salespeople.map((person) => [person.id, person.name]));

  return (
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
  );
}
