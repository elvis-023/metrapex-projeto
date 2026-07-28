import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon, TagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { CustomerTable } from "@/components/customers/customer-table";
import { getCustomers } from "@/lib/customers/queries";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const allCustomers = await getCustomers();
  const normalized = q.trim().toLowerCase();
  const normalizedDigits = normalized.replace(/\D/g, "");
  const customers = normalized
    ? allCustomers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(normalized) ||
          (normalizedDigits.length > 0 && customer.document.includes(normalizedDigits)),
      )
    : allCustomers;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CustomerFilters q={q} />
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href="/customers/sources">
                <TagIcon />
                Origens
              </Link>
            }
            nativeButton={false}
          />
          <Button
            size="sm"
            render={
              <Link href="/customers/new">
                <PlusIcon />
                Novo cliente
              </Link>
            }
            nativeButton={false}
          />
        </div>
      </div>

      <CustomerTable customers={customers} hasAnyCustomers={allCustomers.length > 0} />
    </div>
  );
}
