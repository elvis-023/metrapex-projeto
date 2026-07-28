import type { Metadata } from "next";

import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Novo cliente" };

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Novo cliente</h1>
        <p className="text-muted-foreground text-sm">
          Cadastre um cliente manualmente por CPF ou CNPJ.
        </p>
      </div>
      <CustomerForm />
    </div>
  );
}
