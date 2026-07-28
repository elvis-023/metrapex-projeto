"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

export function CustomerFilters({ q }: { q: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateQuery(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.push(`/customers?${params.toString()}`);
  }

  return (
    <div className="relative flex-1 sm:max-w-xs">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        defaultValue={q}
        placeholder="Buscar por nome ou CPF/CNPJ"
        className="pl-8"
        onChange={(event) => updateQuery(event.target.value)}
      />
    </div>
  );
}
