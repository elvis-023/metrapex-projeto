import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableRowsSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-full sm:max-w-xs" />
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
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
        <TableRowsSkeleton rows={6} columns={6} />
      </Table>
    </div>
  );
}
