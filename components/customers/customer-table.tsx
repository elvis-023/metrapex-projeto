import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import type { Customer } from "@/lib/customers/types";

function formatDocument(document: string): string {
  if (document.length === 11) {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (document.length === 14) {
    return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return document;
}

export function CustomerTable({
  customers,
  hasAnyCustomers,
}: {
  customers: Customer[];
  hasAnyCustomers: boolean;
}) {
  if (customers.length === 0) {
    return hasAnyCustomers ? (
      <EmptyState
        title="Nenhum cliente encontrado"
        description="Ajuste a busca por nome ou CPF/CNPJ."
      />
    ) : (
      <EmptyState
        title="Nenhum cliente cadastrado ainda"
        description="Cadastre manualmente ou aguarde o primeiro pedido pelo formulário público."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome / Razão social</TableHead>
          <TableHead>CPF/CNPJ</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Telefone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id} className="cursor-pointer">
            <TableCell className="font-medium">
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customer.name}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{formatDocument(customer.document)}</TableCell>
            <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {customer.phone || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
