"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon, UserIcon } from "lucide-react";
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
import type { Customer } from "@/lib/customers/types";

type NewCustomerForm = {
  name: string;
  document: string;
  email: string;
  phone: string;
};

const emptyForm: NewCustomerForm = { name: "", document: "", email: "", phone: "" };

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

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const normalizedDigits = normalized.replace(/\D/g, "");
    if (!normalized) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalized) ||
        (normalizedDigits.length > 0 &&
          customer.document.replace(/\D/g, "").includes(normalizedDigits)),
    );
  }, [customers, query]);

  function openCreateDialog() {
    setForm(emptyForm);
    setError(null);
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
      setOpen(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={<Button type="button" variant="outline" onClick={openCreateDialog} />}
          >
            <PlusIcon />
            Novo cliente
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
              <DialogDescription>Cadastro rápido para este orçamento.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
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
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customer-document" className="text-sm font-medium">
                  CPF/CNPJ
                </label>
                <Input
                  id="customer-document"
                  value={form.document}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, document: event.target.value }))
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
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
