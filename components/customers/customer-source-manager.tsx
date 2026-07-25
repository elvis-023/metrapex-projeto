"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";

export type CustomerSourceWithCount = {
  id: string;
  name: string;
  quoteCount: number;
};

export function CustomerSourceManager({
  initialSources,
}: {
  initialSources: CustomerSourceWithCount[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; source: CustomerSourceWithCount } | null
  >(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setDialogState({ mode: "create" });
    setName("");
    setError(null);
  }

  function openEdit(source: CustomerSourceWithCount) {
    setDialogState({ mode: "edit", source });
    setName(source.name);
    setError(null);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome da origem obrigatório.");
      return;
    }
    const isDuplicate = sources.some(
      (source) =>
        source.name.toLowerCase() === trimmed.toLowerCase() &&
        !(dialogState?.mode === "edit" && source.id === dialogState.source.id),
    );
    if (isDuplicate) {
      setError("Já existe uma origem com esse nome.");
      return;
    }

    if (dialogState?.mode === "edit") {
      setSources((current) =>
        current.map((source) =>
          source.id === dialogState.source.id ? { ...source, name: trimmed } : source,
        ),
      );
      toast.success("Origem atualizada.");
    } else {
      setSources((current) => [
        ...current,
        { id: `source_${crypto.randomUUID()}`, name: trimmed, quoteCount: 0 },
      ]);
      toast.success("Origem criada.");
    }
    setDialogState(null);
  }

  function handleDelete(source: CustomerSourceWithCount) {
    if (source.quoteCount > 0) {
      toast.error(
        `Reatribua os ${source.quoteCount} orçamento(s) desta origem antes de excluí-la.`,
      );
      return;
    }
    setSources((current) => current.filter((s) => s.id !== source.id));
    toast.success("Origem removida.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Origens de clientes</h1>
          <p className="text-muted-foreground text-sm">
            De onde os clientes chegam até o orçamento — usado nos relatórios de conversão por
            origem e exibido ao lado do nome do cliente no pipeline.
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
            Nova origem
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogState?.mode === "edit" ? "Editar origem" : "Nova origem"}
              </DialogTitle>
              <DialogDescription>
                Nome exibido junto ao cliente no pipeline e nos relatórios.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="source-name" className="text-sm font-medium">
                Nome
              </label>
              <Input
                id="source-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(error)}
                className={cn(error && "border-destructive")}
              />
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogState(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sources.length === 0 ? (
        <EmptyState
          title="Nenhuma origem cadastrada"
          description="Crie uma origem para acompanhar de onde vêm os clientes."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Orçamentos</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell className="font-medium">{source.name}</TableCell>
                <TableCell className="text-right tabular-nums">{source.quoteCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar origem"
                      onClick={() => openEdit(source)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir origem"
                      onClick={() => handleDelete(source)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
