"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { upsertCustomerAction } from "@/lib/customers/actions";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/customers/types";

type CustomerFormValues = {
  name: string;
  document: string;
  email: string;
  phone: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

function toFormValues(customer?: Customer): CustomerFormValues {
  return {
    name: customer?.name ?? "",
    document: customer?.document ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    zip: customer?.address?.zip ?? "",
    street: customer?.address?.street ?? "",
    number: customer?.address?.number ?? "",
    complement: customer?.address?.complement ?? "",
    neighborhood: customer?.address?.neighborhood ?? "",
    city: customer?.address?.city ?? "",
    state: customer?.address?.state ?? "",
  };
}

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [values, setValues] = useState<CustomerFormValues>(() => toFormValues(customer));
  const [errors, setErrors] = useState<Partial<Record<"name" | "document", string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(customer);

  function setField<K extends keyof CustomerFormValues>(field: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Record<"name" | "document", string>> = {};
    if (!values.name.trim()) nextErrors.name = "Nome/razão social obrigatório.";
    if (!values.document.trim()) nextErrors.document = "CPF/CNPJ obrigatório.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const saved = await upsertCustomerAction({
        name: values.name,
        document: values.document,
        email: values.email,
        phone: values.phone,
        address: {
          zip: values.zip,
          street: values.street,
          number: values.number,
          complement: values.complement,
          neighborhood: values.neighborhood,
          city: values.city,
          state: values.state,
        },
      });
      toast.success(isEditing ? "Cliente atualizado." : "Cliente cadastrado.");
      router.push(isEditing ? `/customers/${saved.id}` : "/customers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cliente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nome / Razão social
            </label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="document" className="text-sm font-medium">
              CPF/CNPJ
            </label>
            <Input
              id="document"
              value={values.document}
              onChange={(event) => setField("document", event.target.value)}
              aria-invalid={Boolean(errors.document)}
              className={cn("tabular-nums", errors.document && "border-destructive")}
            />
            {errors.document ? <p className="text-destructive text-sm">{errors.document}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contato principal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-sm font-medium">
              Telefone
            </label>
            <Input
              id="phone"
              value={values.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="zip" className="text-sm font-medium">
              CEP
            </label>
            <Input
              id="zip"
              value={values.zip}
              onChange={(event) => setField("zip", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="street" className="text-sm font-medium">
              Rua
            </label>
            <Input
              id="street"
              value={values.street}
              onChange={(event) => setField("street", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="number" className="text-sm font-medium">
              Número
            </label>
            <Input
              id="number"
              value={values.number}
              onChange={(event) => setField("number", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="complement" className="text-sm font-medium">
              Complemento
            </label>
            <Input
              id="complement"
              value={values.complement}
              onChange={(event) => setField("complement", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="neighborhood" className="text-sm font-medium">
              Bairro
            </label>
            <Input
              id="neighborhood"
              value={values.neighborhood}
              onChange={(event) => setField("neighborhood", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="text-sm font-medium">
              Cidade
            </label>
            <Input
              id="city"
              value={values.city}
              onChange={(event) => setField("city", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-sm font-medium">
              UF
            </label>
            <Input
              id="state"
              value={values.state}
              onChange={(event) => setField("state", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/customers")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}
