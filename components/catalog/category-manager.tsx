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
import { onlyDigits } from "@/lib/public-form/mock-data";
import { cn } from "@/lib/utils";

export type CategoryWithCount = {
  id: string;
  name: string;
  ncm: string;
  productCount: number;
};

/** Máscara de leitura do NCM (XXXX.XX.XX) — armazenado como 8 dígitos crus. */
function formatNcm(digits: string): string {
  return digits
    .slice(0, 8)
    .replace(/(\d{4})(\d)/, "$1.$2")
    .replace(/(\d{4}\.\d{2})(\d)/, "$1.$2");
}

const NCM_PATTERN = /^\d{8}$/;

export function CategoryManager({ initialCategories }: { initialCategories: CategoryWithCount[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; category: CategoryWithCount } | null
  >(null);
  const [name, setName] = useState("");
  const [ncm, setNcm] = useState("");
  const [errors, setErrors] = useState<{ name?: string; ncm?: string; form?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  function openCreate() {
    setDialogState({ mode: "create" });
    setName("");
    setNcm("");
    setErrors({});
  }

  function openEdit(category: CategoryWithCount) {
    setDialogState({ mode: "edit", category });
    setName(category.name);
    setNcm(category.ncm);
    setErrors({});
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedNcm = ncm.trim();
    const nextErrors: { name?: string; ncm?: string; form?: string } = {};
    if (!trimmedName) nextErrors.name = "Nome da categoria obrigatório.";
    if (!NCM_PATTERN.test(trimmedNcm)) nextErrors.ncm = "NCM deve ter 8 dígitos.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      if (dialogState?.mode === "edit") {
        await updateCategoryAction(dialogState.category.id, trimmedName, trimmedNcm);
        setCategories((current) =>
          current.map((category) =>
            category.id === dialogState.category.id
              ? { ...category, name: trimmedName, ncm: trimmedNcm }
              : category,
          ),
        );
        toast.success("Categoria atualizada.");
      } else {
        const created = await createCategoryAction(trimmedName, trimmedNcm);
        setCategories((current) => [...current, { ...created, productCount: 0 }]);
        toast.success("Categoria criada.");
      }
      setDialogState(null);
      router.refresh();
    } catch (saveError) {
      setErrors({
        form:
          saveError instanceof Error ? saveError.message : "Não foi possível salvar a categoria.",
      });
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
                Nome exibido no catálogo e no motor de impostos. O NCM é obrigatório — usado para
                classificar a mercadoria em regras de ICMS-ST por estado.
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
                aria-invalid={Boolean(errors.name)}
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category-ncm" className="text-sm font-medium">
                NCM
              </label>
              <Input
                id="category-ncm"
                inputMode="numeric"
                placeholder="0000.00.00"
                value={formatNcm(ncm)}
                onChange={(event) => setNcm(onlyDigits(event.target.value).slice(0, 8))}
                aria-invalid={Boolean(errors.ncm)}
                className={cn("tabular-nums", errors.ncm && "border-destructive")}
              />
              {errors.ncm ? <p className="text-destructive text-sm">{errors.ncm}</p> : null}
            </div>
            {errors.form ? <p className="text-destructive text-sm">{errors.form}</p> : null}
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
              <TableHead>NCM</TableHead>
              <TableHead className="text-right">Produtos</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="tabular-nums">{formatNcm(category.ncm)}</TableCell>
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
