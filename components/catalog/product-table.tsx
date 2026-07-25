import Link from "next/link";
import { ImageOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { currencyFormatter, stockFormatter } from "@/lib/catalog/format";
import type { Product, ProductCategory } from "@/lib/catalog/types";

export function ProductTable({
  products,
  categories,
  hasAnyProducts,
}: {
  products: Product[];
  categories: ProductCategory[];
  hasAnyProducts: boolean;
}) {
  if (products.length === 0) {
    return hasAnyProducts ? (
      <EmptyState
        title="Nenhum produto encontrado"
        description="Ajuste a busca ou o filtro de categoria."
      />
    ) : (
      <EmptyState
        title="Nenhum produto cadastrado ainda"
        description="Cadastre manualmente ou importe uma planilha para popular o catálogo."
      />
    );
  }

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12" />
          <TableHead>Código</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Estoque</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id} className="cursor-pointer">
            <TableCell>
              <div className="bg-muted flex size-8 items-center justify-center overflow-hidden rounded-md">
                {product.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.photoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOffIcon className="text-muted-foreground size-4" aria-hidden="true" />
                )}
              </div>
            </TableCell>
            <TableCell className="font-medium">
              <Link href={`/catalog/${product.id}`} className="hover:underline">
                {product.externalCode}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/catalog/${product.id}`} className="hover:underline">
                {product.name}
              </Link>
            </TableCell>
            <TableCell>
              {product.categoryId ? (
                <Badge variant="outline">{categoryNameById.get(product.categoryId) ?? "—"}</Badge>
              ) : (
                <span className="text-muted-foreground">Sem categoria</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {currencyFormatter.format(product.price)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {stockFormatter.format(product.stock)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
