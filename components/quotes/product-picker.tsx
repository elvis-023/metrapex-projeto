"use client";

import { useMemo, useState } from "react";
import { ImageOffIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states/empty-state";
import { currencyFormatter } from "@/lib/catalog/format";
import type { ProductCategory } from "@/lib/catalog/types";
import type { CatalogProduct } from "@/lib/quotes/engine";
import { resolveRate } from "@/lib/tax-engine/resolve-rate";
import type { TaxRateOverride, TaxType } from "@/lib/tax-engine/types";

const ALL_CATEGORIES = "all";

/**
 * Alíquota resolvida pela hierarquia real (produto > categoria > padrão da
 * organização). Só mostra a linha do tributo que incide, ou o override
 * explícito de produto — que pode ser 0% por ST e precisa aparecer com a nota
 * (briefing §7.3), senão a badge zerada parece erro.
 */
function TaxBadges({
  product,
  taxTypes,
  overrides,
}: {
  product: CatalogProduct;
  taxTypes: TaxType[];
  overrides: TaxRateOverride[];
}) {
  const resolved = taxTypes
    .filter((taxType) => taxType.active)
    .map((taxType) => ({
      taxType,
      resolved: resolveRate(taxType, { id: product.id, categoryId: product.categoryId }, overrides),
    }))
    .filter(({ resolved: r }) => r.rate > 0 || r.source === "product");

  if (resolved.length === 0) {
    return <span className="text-muted-foreground text-xs">Sem imposto destacado</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {resolved.map(({ taxType, resolved: r }) => (
        <Badge
          key={taxType.id}
          variant={r.source === "product" ? "outline" : "secondary"}
          title={r.note ?? undefined}
        >
          {taxType.code} {r.rate}% {taxType.mode === "inclusive" ? "por dentro" : "por fora"}
        </Badge>
      ))}
    </div>
  );
}

export function ProductPicker({
  products,
  categories,
  taxTypes,
  overrides,
  onAdd,
}: {
  products: CatalogProduct[];
  categories: ProductCategory[];
  taxTypes: TaxType[];
  overrides: TaxRateOverride[];
  onAdd: (productId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        normalized.length === 0 ||
        product.name.toLowerCase().includes(normalized) ||
        product.externalCode.toLowerCase().includes(normalized);
      const matchesCategory = categoryId === ALL_CATEGORIES || product.categoryId === categoryId;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, categoryId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou código"
            className="pl-8"
          />
        </div>
        <Select value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
          <SelectTrigger aria-label="Filtrar por categoria" className="sm:w-48">
            <SelectValue>
              {(value: string) =>
                value === ALL_CATEGORIES
                  ? "Todas as categorias"
                  : (categories.find((category) => category.id === value)?.name ?? "—")
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

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Ajuste a busca ou o filtro de categoria."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((product) => (
            <div key={product.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <div className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                {product.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.photoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOffIcon className="text-muted-foreground size-4" aria-hidden="true" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{product.name}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {currencyFormatter.format(Number(product.price))}
                  </span>
                </div>
                <TaxBadges product={product} taxTypes={taxTypes} overrides={overrides} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Adicionar ${product.name}`}
                onClick={() => onAdd(product.id)}
              >
                <PlusIcon />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
