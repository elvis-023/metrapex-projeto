"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { upsertCustomerAction } from "@/lib/customers/actions";
import { cn } from "@/lib/utils";
import { isValidCnpj } from "@/lib/public-form/cpf-cnpj";
import { lookupCnpj } from "@/lib/public-form/lookup";
import { formatDocument, onlyDigits } from "@/lib/public-form/mock-data";
import type { LookupStatus } from "@/lib/public-form/types";
import type { Customer } from "@/lib/customers/types";

/** Espera o vendedor parar de digitar — mesmo desenho de components/public-form/step-document.tsx e components/quotes/customer-picker.tsx. */
const LOOKUP_DEBOUNCE_MS = 500;

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
  const [documentLookupStatus, setDocumentLookupStatus] = useState<LookupStatus>("idle");
  const isEditing = Boolean(customer);

  function setField<K extends keyof CustomerFormValues>(field: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * Mesma lógica de identificação por CNPJ do formulário público
   * (lib/public-form/lookup.ts) e do CustomerPicker do construtor de
   * orçamento — só a parte de dados do cliente (razão social + endereço),
   * sem seleção de produto, que não existe nesta tela. A dedupe por
   * documento (Milestone 17) continua inteiramente no servidor
   * (upsert_customer, lib/customers/actions.ts) — esta consulta só
   * preenche o formulário, nunca decide se o cliente já existe.
   */
  const requestedDocumentRef = useRef<string | null>(null);

  const runDocumentLookup = useCallback(async (digits: string) => {
    requestedDocumentRef.current = digits;
    setDocumentLookupStatus("loading");
    try {
      const result = await lookupCnpj(digits);
      if (requestedDocumentRef.current !== digits) return;
      setValues((current) => ({
        ...current,
        name: result.legalName,
        zip: result.address.zip,
        street: result.address.street,
        number: result.address.number,
        complement: result.address.complement,
        neighborhood: result.address.neighborhood,
        city: result.address.city,
        state: result.address.state,
      }));
      setDocumentLookupStatus("done");
    } catch {
      if (requestedDocumentRef.current !== digits) return;
      requestedDocumentRef.current = null;
      setDocumentLookupStatus("error");
    }
  }, []);

  // Só dispara ao CADASTRAR — em edição o cliente já tem dados reais
  // salvos, e reeditar o documento não deve sobrescrever nome/endereço já
  // ajustados manualmente pelo vendedor.
  useEffect(() => {
    if (isEditing) return;
    if (!isValidCnpj(values.document)) return;
    if (requestedDocumentRef.current === values.document) return;

    const digits = values.document;
    const timer = setTimeout(() => runDocumentLookup(digits), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isEditing, values.document, runDocumentLookup]);

  function handleDocumentChange(rawValue: string) {
    setField("document", onlyDigits(rawValue).slice(0, 14));
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
              inputMode="numeric"
              value={formatDocument(values.document)}
              onChange={(event) => handleDocumentChange(event.target.value)}
              aria-invalid={Boolean(errors.document)}
              className={cn("tabular-nums", errors.document && "border-destructive")}
            />
            {errors.document ? <p className="text-destructive text-sm">{errors.document}</p> : null}
            {!isEditing ? (
              <div aria-live="polite">
                {documentLookupStatus === "loading" ? (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
                    Consultando o CNPJ e preenchendo os dados…
                  </p>
                ) : null}
                {documentLookupStatus === "done" ? (
                  <p className="text-muted-foreground text-xs">
                    Dados preenchidos automaticamente. Confira e ajuste se precisar.
                  </p>
                ) : null}
                {documentLookupStatus === "error" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-destructive text-sm">Não encontramos esse CNPJ.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => runDocumentLookup(values.document)}
                    >
                      <SearchIcon />
                      Tentar novamente
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
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
