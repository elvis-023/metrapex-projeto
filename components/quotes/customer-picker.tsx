"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, PlusIcon, SearchIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states/empty-state";
import { upsertCustomerAction } from "@/lib/customers/actions";
import { cn } from "@/lib/utils";
import { detectDocumentType, isValidCnpj, isValidCpf } from "@/lib/public-form/cpf-cnpj";
import { lookupCnpj } from "@/lib/public-form/lookup";
import { formatCep, formatDocument, onlyDigits } from "@/lib/public-form/mock-data";
import { emptyAddress, type LookupStatus, type PublicFormAddress } from "@/lib/public-form/types";
import type { Customer } from "@/lib/customers/types";

type NewCustomerForm = {
  name: string;
  document: string;
  email: string;
  phone: string;
  address: PublicFormAddress;
};

const emptyForm: NewCustomerForm = {
  name: "",
  document: "",
  email: "",
  phone: "",
  address: emptyAddress,
};

/** Espera o vendedor parar de digitar — mesmo desenho de components/public-form/step-document.tsx. */
const LOOKUP_DEBOUNCE_MS = 500;

function findByDocument(customers: Customer[], digits: string): Customer | undefined {
  return customers.find((customer) => onlyDigits(customer.document) === digits);
}

export function CustomerPicker({
  customers,
  selected,
  onSelect,
  onClear,
  onCreate,
}: {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
  onCreate: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewCustomerForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [documentLookupStatus, setDocumentLookupStatus] = useState<LookupStatus>("idle");

  const results = query.trim()
    ? customers.filter((customer) => {
        const normalized = query.trim().toLowerCase();
        const normalizedDigits = normalized.replace(/\D/g, "");
        return (
          customer.name.toLowerCase().includes(normalized) ||
          (normalizedDigits.length > 0 &&
            customer.document.replace(/\D/g, "").includes(normalizedDigits))
        );
      })
    : customers;

  function openCreateDialog() {
    setForm(emptyForm);
    setError(null);
    setDocumentLookupStatus("idle");
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setForm(emptyForm);
    setError(null);
    setDocumentLookupStatus("idle");
  }

  /**
   * Reaproveita o client de consulta do formulário público
   * (lib/public-form/lookup.ts, proxy de app/api/public-quote/lookup-cnpj) —
   * mesmo contrato, mesma chamada à BrasilAPI, sem duplicar a lógica aqui
   * (mesmo padrão já usado em components/onboarding/step-organization.tsx).
   */
  const requestedDocumentRef = useRef<string | null>(null);

  const runDocumentLookup = useCallback(async (digits: string) => {
    requestedDocumentRef.current = digits;
    setDocumentLookupStatus("loading");
    try {
      const result = await lookupCnpj(digits);
      if (requestedDocumentRef.current !== digits) return;
      setForm((current) => ({ ...current, name: result.legalName, address: result.address }));
      setDocumentLookupStatus("done");
    } catch {
      if (requestedDocumentRef.current !== digits) return;
      requestedDocumentRef.current = null;
      setDocumentLookupStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!isValidCnpj(form.document)) return;
    if (requestedDocumentRef.current === form.document) return;

    const digits = form.document;
    const timer = setTimeout(() => runDocumentLookup(digits), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form.document, runDocumentLookup]);

  /**
   * Documento já é de um cliente desta organização — checagem local
   * (síncrona, sem chamar a BrasilAPI) disparada pelo próprio evento de
   * digitação, não por um efeito: não é sincronização com sistema externo,
   * é resposta direta à ação do vendedor. O formulário público não tem este
   * passo (lá a submissão é sempre nova e a dedupe acontece calada no
   * banco); aqui o vendedor precisa ver que achou, não recriar.
   */
  function handleDocumentChange(rawValue: string) {
    const digits = onlyDigits(rawValue).slice(0, 14);
    setForm((current) => ({ ...current, document: digits }));

    const docType = detectDocumentType(digits);
    const docValid =
      docType === "cnpj" ? isValidCnpj(digits) : docType === "cpf" ? isValidCpf(digits) : false;
    if (!docValid) return;

    const existing = findByDocument(customers, digits);
    if (existing) {
      onSelect(existing);
      closeDialog();
      toast.success(`Cliente "${existing.name}" já cadastrado — selecionado.`);
    }
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.document.trim()) {
      setError("Nome e CPF/CNPJ são obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      const customer = await upsertCustomerAction(form);
      onCreate(customer);
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar o cliente.");
      toast.error(err instanceof Error ? err.message : "Não foi possível cadastrar o cliente.");
    } finally {
      setIsSaving(false);
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="bg-muted flex size-8 items-center justify-center rounded-full">
            <UserIcon className="text-muted-foreground size-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{selected.name}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{selected.document}</span>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Trocar cliente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ"
            className="pl-8"
          />
        </div>
        <Dialog open={open} onOpenChange={(next) => (next ? openCreateDialog() : closeDialog())}>
          <DialogTrigger render={<Button type="button" variant="outline" />}>
            <PlusIcon />
            Novo cliente
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
              <DialogDescription>
                Digite o CPF ou CNPJ — se já for cliente, o sistema encontra sozinho; se for CNPJ
                novo, razão social e endereço são preenchidos automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customer-document" className="text-sm font-medium">
                  CPF/CNPJ
                </label>
                <Input
                  id="customer-document"
                  inputMode="numeric"
                  value={formatDocument(form.document)}
                  onChange={(event) => handleDocumentChange(event.target.value)}
                  aria-invalid={Boolean(error)}
                  className={cn(error && "border-destructive")}
                />
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
                        onClick={() => runDocumentLookup(form.document)}
                      >
                        <SearchIcon />
                        Tentar novamente
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customer-name" className="text-sm font-medium">
                  Nome / Razão social
                </label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  aria-invalid={Boolean(error)}
                  className={cn(error && "border-destructive")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="customer-email" className="text-sm font-medium">
                    E-mail
                  </label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="customer-phone" className="text-sm font-medium">
                    Telefone
                  </label>
                  <Input
                    id="customer-phone"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium">Endereço</span>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="customer-zip" className="text-xs font-medium">
                    CEP
                  </label>
                  <Input
                    id="customer-zip"
                    inputMode="numeric"
                    value={formatCep(form.address.zip)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        address: {
                          ...current.address,
                          zip: onlyDigits(event.target.value).slice(0, 8),
                        },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label htmlFor="customer-street" className="text-xs font-medium">
                      Rua
                    </label>
                    <Input
                      id="customer-street"
                      value={form.address.street}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: { ...current.address, street: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-number" className="text-xs font-medium">
                      Número
                    </label>
                    <Input
                      id="customer-number"
                      value={form.address.number}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: { ...current.address, number: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-neighborhood" className="text-xs font-medium">
                      Bairro
                    </label>
                    <Input
                      id="customer-neighborhood"
                      value={form.address.neighborhood}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: { ...current.address, neighborhood: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-complement" className="text-xs font-medium">
                      Complemento
                    </label>
                    <Input
                      id="customer-complement"
                      value={form.address.complement}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: { ...current.address, complement: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label htmlFor="customer-city" className="text-xs font-medium">
                      Cidade
                    </label>
                    <Input
                      id="customer-city"
                      value={form.address.city}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: { ...current.address, city: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-state" className="text-xs font-medium">
                      UF
                    </label>
                    <Input
                      id="customer-state"
                      maxLength={2}
                      value={form.address.state}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          address: { ...current.address, state: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? "Cadastrando…" : "Cadastrar e selecionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {results.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Ajuste a busca ou cadastre um novo cliente."
          />
        ) : (
          results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelect(customer)}
              className="hover:bg-muted flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{customer.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {customer.document}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
