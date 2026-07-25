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

export type CategoryWithCount = {
  id: string;
  name: string;
  productCount: number;
};

export function CategoryManager({ initialCategories }: { initialCategories: CategoryWithCount[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; category: CategoryWithCount } | null
  >(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setDialogState({ mode: "create" });
    setName("");
    setError(null);
  }

  function openEdit(category: CategoryWithCount) {
    setDialogState({ mode: "edit", category });
    setName(category.name);
    setError(null);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome da categoria obrigatório.");
      return;
    }
    const isDuplicate = categories.some(
      (category) =>
        category.name.toLowerCase() === trimmed.toLowerCase() &&
        !(dialogState?.mode === "edit" && category.id === dialogState.category.id),
    );
    if (isDuplicate) {
      setError("Já existe uma categoria com esse nome.");
      return;
    }

    if (dialogState?.mode === "edit") {
      setCategories((current) =>
        current.map((category) =>
          category.id === dialogState.category.id ? { ...category, name: trimmed } : category,
        ),
      );
      toast.success("Categoria atualizada.");
    } else {
      setCategories((current) => [
        ...current,
        { id: `cat_${crypto.randomUUID()}`, name: trimmed, productCount: 0 },
      ]);
      toast.success("Categoria criada.");
    }
    setDialogState(null);
  }

  function handleDelete(category: CategoryWithCount) {
    if (category.productCount > 0) {
      toast.error(
        `Remova ou realoque os ${category.productCount} produto(s) desta categoria antes de excluí-la.`,
      );
      return;
    }
    setCategories((current) => current.filter((c) => c.id !== category.id));
    toast.success("Categoria removida.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Categorias</h1>
          <p className="text-muted-foreground text-sm">
            Categorias são genéricas e configuráveis — o motor de impostos usa esse vínculo para
            resolver alíquota por categoria.
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
            Nova categoria
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogState?.mode === "edit" ? "Editar categoria" : "Nova categoria"}
              </DialogTitle>
              <DialogDescription>
                Nome exibido no catálogo e no motor de impostos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category-name" className="text-sm font-medium">
                Nome
              </label>
              <Input
                id="category-name"
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

      {categories.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria cadastrada"
          description="Crie uma categoria para organizar o catálogo e configurar overrides de imposto."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Produtos</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-right tabular-nums">{category.productCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar categoria"
                      onClick={() => openEdit(category)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir categoria"
                      onClick={() => handleDelete(category)}
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
