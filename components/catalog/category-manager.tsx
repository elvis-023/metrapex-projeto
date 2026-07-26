"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/lib/catalog/actions";
import { cn } from "@/lib/utils";

export type CategoryWithCount = {
  id: string;
  name: string;
  productCount: number;
};

export function CategoryManager({ initialCategories }: { initialCategories: CategoryWithCount[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; category: CategoryWithCount } | null
  >(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome da categoria obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      if (dialogState?.mode === "edit") {
        await updateCategoryAction(dialogState.category.id, trimmed);
        setCategories((current) =>
          current.map((category) =>
            category.id === dialogState.category.id ? { ...category, name: trimmed } : category,
          ),
        );
        toast.success("Categoria atualizada.");
      } else {
        const created = await createCategoryAction(trimmed);
        setCategories((current) => [...current, { ...created, productCount: 0 }]);
        toast.success("Categoria criada.");
      }
      setDialogState(null);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar a categoria.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(category: CategoryWithCount) {
    try {
      await deleteCategoryAction(category.id);
      setCategories((current) => current.filter((c) => c.id !== category.id));
      toast.success("Categoria removida.");
      router.refresh();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir a categoria.",
      );
    }
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
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
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
