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
import type { ProductCategory } from "@/lib/catalog/types";

const ALL_CATEGORIES = "all";

export function ProductFilters({
  categories,
  q,
  categoryId,
}: {
  categories: ProductCategory[];
  q: string;
  categoryId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== ALL_CATEGORIES) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/catalog?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          defaultValue={q}
          placeholder="Buscar por nome ou código"
          className="pl-8"
          onChange={(event) => updateParam("q", event.target.value)}
        />
      </div>
      <Select value={categoryId || ALL_CATEGORIES} onValueChange={(value) => updateParam("category", value)}>
        <SelectTrigger aria-label="Filtrar por categoria" className="sm:w-48">
          <SelectValue>
            {(value: string) =>
              value === ALL_CATEGORIES ? "Todas as categorias" : (categoryNameById.get(value) ?? "—")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES}>Todas as categorias</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
