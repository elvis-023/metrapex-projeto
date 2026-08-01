"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { ProductCategory, Product } from "@/lib/catalog/types";
import type {
  TaxMode,
  TaxOverrideScope,
  TaxRateOverrideSetting,
  TaxTypeSetting,
} from "@/lib/settings/types";

function isValidRate(value: string): boolean {
  return /^\d+([.,]\d{1,4})?$/.test(value.trim());
}

function parseRate(value: string): number {
  return Number(value.trim().replace(",", "."));
}

type TaxTypeDialogState = { mode: "create" } | { mode: "edit"; taxType: TaxTypeSetting } | null;
type OverrideDialogState =
  { mode: "create" } | { mode: "edit"; override: TaxRateOverrideSetting } | null;

export function TaxSettingsManager({
  initialTaxTypes,
  initialOverrides,
  categories,
  products,
}: {
  initialTaxTypes: TaxTypeSetting[];
  initialOverrides: TaxRateOverrideSetting[];
  categories: ProductCategory[];
  products: Product[];
}) {
  const [taxTypes, setTaxTypes] = useState(initialTaxTypes);
  const [overrides, setOverrides] = useState(initialOverrides);

  const [taxTypeDialog, setTaxTypeDialog] = useState<TaxTypeDialogState>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<TaxMode>("exclusive");
  const [defaultRate, setDefaultRate] = useState("");
  const [taxTypeErrors, setTaxTypeErrors] = useState<{
    code?: string;
    label?: string;
    rate?: string;
  }>({});

  const [overrideDialog, setOverrideDialog] = useState<OverrideDialogState>(null);
  const [overrideTaxTypeId, setOverrideTaxTypeId] = useState("");
  const [overrideScope, setOverrideScope] = useState<TaxOverrideScope>("category");
  const [overrideCategoryId, setOverrideCategoryId] = useState("");
  const [overrideProductId, setOverrideProductId] = useState("");
  const [overrideRate, setOverrideRate] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideErrors, setOverrideErrors] = useState<{ scope?: string; rate?: string }>({});

  function openCreateTaxType() {
    setTaxTypeDialog({ mode: "create" });
    setCode("");
    setLabel("");
    setMode("exclusive");
    setDefaultRate("");
    setTaxTypeErrors({});
  }

  function openEditTaxType(taxType: TaxTypeSetting) {
    setTaxTypeDialog({ mode: "edit", taxType });
    setCode(taxType.code);
    setLabel(taxType.label);
    setMode(taxType.mode);
    setDefaultRate(String(taxType.defaultRate).replace(".", ","));
    setTaxTypeErrors({});
  }

  function handleSaveTaxType() {
    const trimmedCode = code.trim();
    const trimmedLabel = label.trim();
    const nextErrors: { code?: string; label?: string; rate?: string } = {};

    if (!trimmedCode) nextErrors.code = "Código obrigatório.";
    else if (
      taxTypes.some(
        (t) =>
          t.code.toLowerCase() === trimmedCode.toLowerCase() &&
          !(taxTypeDialog?.mode === "edit" && t.id === taxTypeDialog.taxType.id),
      )
    ) {
      nextErrors.code = "Já existe um tributo com esse código.";
    }
    if (!trimmedLabel) nextErrors.label = "Rótulo obrigatório.";
    if (!defaultRate.trim()) nextErrors.rate = "Alíquota padrão obrigatória.";
    else if (!isValidRate(defaultRate))
      nextErrors.rate = "Use vírgula para casas decimais (ex.: 18,00).";
    else if (parseRate(defaultRate) > 100) nextErrors.rate = "Alíquota não pode passar de 100%.";

    setTaxTypeErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (taxTypeDialog?.mode === "edit") {
      setTaxTypes((current) =>
        current.map((t) =>
          t.id === taxTypeDialog.taxType.id
            ? {
                ...t,
                code: trimmedCode,
                label: trimmedLabel,
                mode,
                defaultRate: parseRate(defaultRate),
              }
            : t,
        ),
      );
      toast.success("Tributo atualizado.");
    } else {
      setTaxTypes((current) => [
        ...current,
        {
          id: `tax_${crypto.randomUUID()}`,
          code: trimmedCode,
          label: trimmedLabel,
          mode,
          defaultRate: parseRate(defaultRate),
        },
      ]);
      toast.success("Tributo criado.");
    }
    setTaxTypeDialog(null);
  }

  function handleDeleteTaxType(taxType: TaxTypeSetting) {
    const dependentOverrides = overrides.filter((o) => o.taxTypeId === taxType.id);
    if (dependentOverrides.length > 0) {
      toast.error(
        `Remova os ${dependentOverrides.length} override(s) deste tributo antes de excluí-lo.`,
      );
      return;
    }
    setTaxTypes((current) => current.filter((t) => t.id !== taxType.id));
    toast.success("Tributo removido.");
  }

  function openCreateOverride() {
    setOverrideDialog({ mode: "create" });
    setOverrideTaxTypeId(taxTypes[0]?.id ?? "");
    setOverrideScope("category");
    setOverrideCategoryId(categories[0]?.id ?? "");
    setOverrideProductId(products[0]?.id ?? "");
    setOverrideRate("");
    setOverrideNote("");
    setOverrideErrors({});
  }

  function openEditOverride(override: TaxRateOverrideSetting) {
    setOverrideDialog({ mode: "edit", override });
    setOverrideTaxTypeId(override.taxTypeId);
    setOverrideScope(override.scope);
    setOverrideCategoryId(override.categoryId ?? categories[0]?.id ?? "");
    setOverrideProductId(override.productId ?? products[0]?.id ?? "");
    setOverrideRate(String(override.rate).replace(".", ","));
    setOverrideNote(override.note ?? "");
    setOverrideErrors({});
  }

  function handleSaveOverride() {
    const scopeId = overrideScope === "category" ? overrideCategoryId : overrideProductId;
    const nextErrors: { scope?: string; rate?: string } = {};

    if (!scopeId) nextErrors.scope = "Selecione uma categoria ou produto.";
    else {
      const isDuplicate = overrides.some(
        (o) =>
          o.taxTypeId === overrideTaxTypeId &&
          o.scope === overrideScope &&
          (overrideScope === "category" ? o.categoryId === scopeId : o.productId === scopeId) &&
          !(overrideDialog?.mode === "edit" && o.id === overrideDialog.override.id),
      );
      if (isDuplicate) {
        nextErrors.scope = "Já existe um override deste tributo para esse escopo.";
      }
    }
    if (!overrideRate.trim()) nextErrors.rate = "Alíquota obrigatória.";
    else if (!isValidRate(overrideRate))
      nextErrors.rate = "Use vírgula para casas decimais (ex.: 5,00).";
    else if (parseRate(overrideRate) > 100) nextErrors.rate = "Alíquota não pode passar de 100%.";

    setOverrideErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: Omit<TaxRateOverrideSetting, "id"> = {
      taxTypeId: overrideTaxTypeId,
      scope: overrideScope,
      categoryId: overrideScope === "category" ? overrideCategoryId : null,
      productId: overrideScope === "product" ? overrideProductId : null,
      rate: parseRate(overrideRate),
      note: overrideNote.trim() || null,
    };

    if (overrideDialog?.mode === "edit") {
      setOverrides((current) =>
        current.map((o) => (o.id === overrideDialog.override.id ? { ...o, ...payload } : o)),
      );
      toast.success("Override atualizado.");
    } else {
      setOverrides((current) => [
        ...current,
        { id: `override_${crypto.randomUUID()}`, ...payload },
      ]);
      toast.success("Override criado.");
    }
    setOverrideDialog(null);
  }

  function handleDeleteOverride(override: TaxRateOverrideSetting) {
    setOverrides((current) => current.filter((o) => o.id !== override.id));
    toast.success("Override removido.");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ponto de partida editável, nunca regra travada (briefing §9): o preset
          do regime tributário sugere tributo, modo e alíquota, mas quem confirma
          se aquilo é o certo pra esta organização é o contador dela — o sistema
          não valida a legislação em si, só congela o que foi configurado. */}
      <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-sm">
        Estes tributos e alíquotas são um ponto de partida sugerido pelo regime tributário da
        organização — não são verdade fiscal. Confirme com o contador da organização quais
        tributos realmente incidem, o modo de cálculo e a alíquota de cada um antes de emitir
        orçamentos com valor oficial.
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Tipos de tributo</CardTitle>
            <CardDescription>
              Cada tributo que a organização destaca no orçamento — modo de cálculo e alíquota
              padrão. O nível mais específico (produto, depois categoria) sempre vence esse padrão.
            </CardDescription>
          </div>
          <Dialog
            open={taxTypeDialog !== null}
            onOpenChange={(open) => !open && setTaxTypeDialog(null)}
          >
            <DialogTrigger render={<Button size="sm" onClick={openCreateTaxType} />}>
              <PlusIcon />
              Novo tributo
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {taxTypeDialog?.mode === "edit" ? "Editar tributo" : "Novo tributo"}
                </DialogTitle>
                <DialogDescription>
                  Modo &ldquo;embutido no preço&rdquo; extrai a base do preço cheio; &ldquo;somado
                  por fora&rdquo; soma o imposto ao preço.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="tax-code" className="text-sm font-medium">
                      Código
                    </label>
                    <Input
                      id="tax-code"
                      placeholder="ICMS"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      aria-invalid={Boolean(taxTypeErrors.code)}
                      className={cn(taxTypeErrors.code && "border-destructive")}
                    />
                    {taxTypeErrors.code ? (
                      <p className="text-destructive text-sm">{taxTypeErrors.code}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="tax-label" className="text-sm font-medium">
                      Rótulo impresso
                    </label>
                    <Input
                      id="tax-label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      aria-invalid={Boolean(taxTypeErrors.label)}
                      className={cn(taxTypeErrors.label && "border-destructive")}
                    />
                    {taxTypeErrors.label ? (
                      <p className="text-destructive text-sm">{taxTypeErrors.label}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="tax-mode" className="text-sm font-medium">
                      Modo de cálculo
                    </label>
                    <Select
                      value={mode}
                      onValueChange={(value) => value && setMode(value as TaxMode)}
                    >
                      <SelectTrigger id="tax-mode" className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            value === "inclusive" ? "Embutido no preço" : "Somado por fora"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exclusive">Somado por fora</SelectItem>
                        <SelectItem value="inclusive">Embutido no preço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="tax-rate" className="text-sm font-medium">
                      Alíquota padrão (%)
                    </label>
                    <Input
                      id="tax-rate"
                      inputMode="decimal"
                      placeholder="18,00"
                      value={defaultRate}
                      onChange={(event) => setDefaultRate(event.target.value)}
                      aria-invalid={Boolean(taxTypeErrors.rate)}
                      className={cn("tabular-nums", taxTypeErrors.rate && "border-destructive")}
                    />
                    {taxTypeErrors.rate ? (
                      <p className="text-destructive text-sm">{taxTypeErrors.rate}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTaxTypeDialog(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveTaxType}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {taxTypes.length === 0 ? (
            <EmptyState
              title="Nenhum tributo cadastrado"
              description="Organização sem tributo destacado é configuração válida — crie um tributo aqui quando precisar destacar imposto no orçamento."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Rótulo</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Alíquota padrão</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxTypes.map((taxType) => (
                  <TableRow key={taxType.id}>
                    <TableCell className="font-mono font-medium">{taxType.code}</TableCell>
                    <TableCell>{taxType.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {taxType.mode === "inclusive" ? "Embutido no preço" : "Somado por fora"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {taxType.defaultRate}%
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar tributo"
                          onClick={() => openEditTaxType(taxType)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir tributo"
                          onClick={() => handleDeleteTaxType(taxType)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Overrides por categoria e produto</CardTitle>
            <CardDescription>
              Alíquota específica que vence o padrão da organização. Override por produto vence
              override por categoria — inclusive quando a alíquota do override é 0%.
            </CardDescription>
          </div>
          <Dialog
            open={overrideDialog !== null}
            onOpenChange={(open) => !open && setOverrideDialog(null)}
          >
            <DialogTrigger
              render={
                <Button size="sm" onClick={openCreateOverride} disabled={taxTypes.length === 0} />
              }
            >
              <PlusIcon />
              Novo override
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {overrideDialog?.mode === "edit" ? "Editar override" : "Novo override"}
                </DialogTitle>
                <DialogDescription>
                  Escolha exatamente um escopo — categoria ou produto — para esse tributo.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="override-tax-type" className="text-sm font-medium">
                    Tributo
                  </label>
                  <Select
                    value={overrideTaxTypeId}
                    onValueChange={(value) => value && setOverrideTaxTypeId(value)}
                  >
                    <SelectTrigger id="override-tax-type" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          taxTypes.find((t) => t.id === value)?.label ?? "Selecione"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {taxTypes.map((taxType) => (
                        <SelectItem key={taxType.id} value={taxType.id}>
                          {taxType.label} ({taxType.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Escopo</span>
                  <div className="border-input inline-flex w-fit overflow-hidden rounded-lg border">
                    <button
                      type="button"
                      aria-pressed={overrideScope === "category"}
                      onClick={() => setOverrideScope("category")}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium transition-colors",
                        overrideScope === "category"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      Categoria
                    </button>
                    <button
                      type="button"
                      aria-pressed={overrideScope === "product"}
                      onClick={() => setOverrideScope("product")}
                      className={cn(
                        "border-input border-l px-2.5 py-1 text-xs font-medium transition-colors",
                        overrideScope === "product"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      Produto
                    </button>
                  </div>
                </div>

                {overrideScope === "category" ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="override-category" className="text-sm font-medium">
                      Categoria
                    </label>
                    <Select
                      value={overrideCategoryId}
                      onValueChange={(value) => value && setOverrideCategoryId(value)}
                    >
                      <SelectTrigger id="override-category" className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            categories.find((c) => c.id === value)?.name ?? "Selecione"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="override-product" className="text-sm font-medium">
                      Produto
                    </label>
                    <Select
                      value={overrideProductId}
                      onValueChange={(value) => value && setOverrideProductId(value)}
                    >
                      <SelectTrigger id="override-product" className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            products.find((p) => p.id === value)?.name ?? "Selecione"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {overrideErrors.scope ? (
                  <p className="text-destructive text-sm">{overrideErrors.scope}</p>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="override-rate" className="text-sm font-medium">
                      Alíquota (%)
                    </label>
                    <Input
                      id="override-rate"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={overrideRate}
                      onChange={(event) => setOverrideRate(event.target.value)}
                      aria-invalid={Boolean(overrideErrors.rate)}
                      className={cn("tabular-nums", overrideErrors.rate && "border-destructive")}
                    />
                    {overrideErrors.rate ? (
                      <p className="text-destructive text-sm">{overrideErrors.rate}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="override-note" className="text-sm font-medium">
                      Nota (opcional)
                    </label>
                    <Input
                      id="override-note"
                      placeholder="Ex.: ICMS-ST recolhido pelo fabricante"
                      value={overrideNote}
                      onChange={(event) => setOverrideNote(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOverrideDialog(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveOverride}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <EmptyState
              title="Nenhum override cadastrado"
              description="Sem overrides, todo produto usa a alíquota padrão do tributo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tributo</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((override) => {
                  const taxType = taxTypes.find((t) => t.id === override.taxTypeId);
                  const scopeName =
                    override.scope === "category"
                      ? categories.find((c) => c.id === override.categoryId)?.name
                      : products.find((p) => p.id === override.productId)?.name;

                  const overriddenProduct =
                    override.scope === "product"
                      ? products.find((p) => p.id === override.productId)
                      : null;
                  const shadowedCategoryOverride =
                    overriddenProduct?.categoryId != null
                      ? overrides.find(
                          (o) =>
                            o.scope === "category" &&
                            o.taxTypeId === override.taxTypeId &&
                            o.categoryId === overriddenProduct.categoryId,
                        )
                      : undefined;

                  const shadowingProductCount =
                    override.scope === "category"
                      ? overrides.filter(
                          (o) =>
                            o.scope === "product" &&
                            o.taxTypeId === override.taxTypeId &&
                            products.find((p) => p.id === o.productId)?.categoryId ===
                              override.categoryId,
                        ).length
                      : 0;

                  return (
                    <TableRow key={override.id}>
                      <TableCell className="font-medium">{taxType?.code ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={override.scope === "product" ? "outline" : "secondary"}>
                          {override.scope === "category" ? "Categoria" : "Produto"}:{" "}
                          {scopeName ?? "—"}
                        </Badge>
                        {shadowedCategoryOverride ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Vence o override de categoria ({shadowedCategoryOverride.rate}% —
                            específico do produto sempre prevalece)
                          </p>
                        ) : null}
                        {shadowingProductCount > 0 ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Não vale para {shadowingProductCount} produto(s) desta categoria com
                            override próprio
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {override.rate}%
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-64 truncate whitespace-normal">
                        {override.note ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar override"
                            onClick={() => openEditOverride(override)}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Excluir override"
                            onClick={() => handleDeleteOverride(override)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
