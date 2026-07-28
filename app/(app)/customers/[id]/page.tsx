import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerContacts } from "@/components/customers/customer-contacts";
import { CustomerDeleteButton } from "@/components/customers/customer-delete-button";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomerById } from "@/lib/customers/queries";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Editar cliente</h1>
          <p className="text-muted-foreground text-sm tabular-nums">{customer.document}</p>
        </div>
        <CustomerDeleteButton customerId={customer.id} customerName={customer.name} />
      </div>
      <CustomerForm customer={customer} />
      <CustomerContacts customerId={customer.id} initialContacts={customer.contacts} />
    </div>
  );
}
