"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react";
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
import { deleteCustomerContactAction, upsertCustomerContactAction } from "@/lib/customers/actions";
import { cn } from "@/lib/utils";
import type { CustomerContact } from "@/lib/customers/types";

type ContactForm = { name: string; email: string; phone: string };

const emptyForm: ContactForm = { name: "", email: "", phone: "" };

export function CustomerContacts({
  customerId,
  initialContacts,
}: {
  customerId: string;
  initialContacts: CustomerContact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; contact: CustomerContact } | null
  >(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openCreate() {
    setDialogState({ mode: "create" });
    setForm(emptyForm);
    setError(null);
  }

  function openEdit(contact: CustomerContact) {
    setDialogState({ mode: "edit", contact });
    setForm({ name: contact.name, email: contact.email, phone: contact.phone });
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Nome do contato obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await upsertCustomerContactAction(customerId, form);
      setContacts((current) => {
        const withoutSaved = current.filter((contact) => contact.id !== saved.id);
        return [...withoutSaved, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success(dialogState?.mode === "edit" ? "Contato atualizado." : "Contato adicionado.");
      setDialogState(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível salvar o contato.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(contact: CustomerContact) {
    try {
      await deleteCustomerContactAction(contact.id, customerId);
      setContacts((current) => current.filter((c) => c.id !== contact.id));
      toast.success("Contato removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover o contato.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Contatos</h2>
          <p className="text-muted-foreground text-sm">
            Pessoas associadas a este cliente — quem pede orçamento, compra ou aprova pagamento.
          </p>
        </div>
        <Dialog
          open={dialogState !== null}
          onOpenChange={(open) => {
            if (!open) setDialogState(null);
          }}
        >
          <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
            <PlusIcon />
            Novo contato
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogState?.mode === "edit" ? "Editar contato" : "Novo contato"}
              </DialogTitle>
              <DialogDescription>
                Contatos com o mesmo e-mail de um já existente atualizam o registro, em vez de
                duplicar.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-name" className="text-sm font-medium">
                  Nome
                </label>
                <Input
                  id="contact-name"
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
                  <label htmlFor="contact-email" className="text-sm font-medium">
                    E-mail
                  </label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-phone" className="text-sm font-medium">
                    Telefone
                  </label>
                  <Input
                    id="contact-phone"
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
              <Button variant="outline" onClick={() => setDialogState(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title="Nenhum contato cadastrado"
          description="Adicione as pessoas que falam por este cliente."
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-muted flex size-8 items-center justify-center rounded-full">
                  <UserIcon className="text-muted-foreground size-4" aria-hidden="true" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{contact.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar contato"
                  onClick={() => openEdit(contact)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Excluir contato"
                  onClick={() => handleDelete(contact)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
