"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { updateOrganizationStateAction } from "@/lib/organizations/actions";
import {
  applyRegimeTemplateAction,
  createTaxRateOverrideAction,
  createTaxTypeAction,
  deleteTaxRateOverrideAction,
  deleteTaxTypeAction,
  updateOrganizationRegimeAction,
  updateTaxRateOverrideAction,
  updateTaxSettingsAction,
  updateTaxTypeAction,
} from "@/lib/tax-engine/actions";
import {
  buildTaxTemplatePlan,
  TAX_REGIMES,
  TAX_REGIME_LABELS,
  templateIdForRegime,
  type TaxRegime,
} from "@/lib/tax-engine/onboarding-templates";

function isValidRate(value: string): boolean {
  return /^\d+([.,]\d{1,4})?$/.test(value.trim());
}

function parseRate(value: string): number {
  return Number(value.trim().replace(",", "."));
}

/** Regimes que, na configuração padrão, não destacam tributo (briefing §6). */
const REGIMES_SEM_DESTAQUE = new Set<TaxRegime>(["mei", "simples_nacional"]);

type TaxTypeDialogState = { mode: "create" } | { mode: "edit"; taxType: TaxTypeSetting } | null;
type OverrideDialogState =
  { mode: "create" } | { mode: "edit"; override: TaxRateOverrideSetting } | null;

export function TaxSettingsManager({
  taxRegime: initialTaxRegime,
  initialTaxTypes,
  initialOverrides,
  initialDocumentFooter,
  initialShowTaxLines,
  initialOrganizationState,
  categories,
  products,
}: {
  taxRegime: TaxRegime | null;
  initialTaxTypes: TaxTypeSetting[];
  initialOverrides: TaxRateOverrideSetting[];
  initialDocumentFooter: string | null;
  initialShowTaxLines: boolean;
  /** UF de origem da organização (Bloco 3b) — null = ainda não preenchida. */
  initialOrganizationState: string | null;
  categories: ProductCategory[];
  products: Product[];
}) {
  const router = useRouter();
  const [taxTypes, setTaxTypes] = useState(initialTaxTypes);
  const [overrides, setOverrides] = useState(initialOverrides);
  const [documentFooter, setDocumentFooter] = useState(initialDocumentFooter ?? "");
  const [showTaxLines, setShowTaxLines] = useState(initialShowTaxLines);
  const [taxRegime, setTaxRegime] = useState(initialTaxRegime);
  const [organizationState, setOrganizationState] = useState(initialOrganizationState ?? "");
  const [isSavingOrganizationState, setIsSavingOrganizationState] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isChangingRegime, setIsChangingRegime] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyIcmsRate, setApplyIcmsRate] = useState("18,00");
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

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
  const [isSavingTaxType, setIsSavingTaxType] = useState(false);

  const [overrideDialog, setOverrideDialog] = useState<OverrideDialogState>(null);
  const [overrideTaxTypeId, setOverrideTaxTypeId] = useState("");
  const [overrideScope, setOverrideScope] = useState<TaxOverrideScope>("category");
  const [overrideCategoryId, setOverrideCategoryId] = useState("");
  const [overrideProductId, setOverrideProductId] = useState("");
  const [overrideRate, setOverrideRate] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideErrors, setOverrideErrors] = useState<{ scope?: string; rate?: string }>({});
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  const regimeSemDestaque = taxRegime !== null && REGIMES_SEM_DESTAQUE.has(taxRegime);
  const regimeLabel = taxRegime ? TAX_REGIME_LABELS[taxRegime] : null;

  const applyPreviewPlan = taxRegime
    ? buildTaxTemplatePlan({
        templateId: templateIdForRegime(taxRegime),
        icmsRate: parseRate(applyIcmsRate) || 0,
        footerText: "",
      })
    : null;

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

  async function handleSaveTaxType() {
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

    const input = {
      code: trimmedCode,
      label: trimmedLabel,
      mode,
      defaultRate: parseRate(defaultRate),
    };
    setIsSavingTaxType(true);
    try {
      if (taxTypeDialog?.mode === "edit") {
        const updated = await updateTaxTypeAction(taxTypeDialog.taxType.id, input);
        setTaxTypes((current) => current.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Tributo atualizado.");
      } else {
        const created = await createTaxTypeAction(input);
        setTaxTypes((current) => [...current, created]);
        toast.success("Tributo criado.");
      }
      setTaxTypeDialog(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o tributo.";
      if (message.toLowerCase().includes("código")) setTaxTypeErrors({ code: message });
      else toast.error(message);
    } finally {
      setIsSavingTaxType(false);
    }
  }

  async function handleDeleteTaxType(taxType: TaxTypeSetting) {
    const dependentOverrides = overrides.filter((o) => o.taxTypeId === taxType.id);
    if (dependentOverrides.length > 0) {
      toast.error(
        `Remova os ${dependentOverrides.length} override(s) deste tributo antes de excluí-lo.`,
      );
      return;
    }
    try {
      await deleteTaxTypeAction(taxType.id);
      setTaxTypes((current) => current.filter((t) => t.id !== taxType.id));
      toast.success("Tributo removido.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o tributo.");
    }
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

  async function handleSaveOverride() {
    const isEdit = overrideDialog?.mode === "edit";
    const scopeId = overrideScope === "category" ? overrideCategoryId : overrideProductId;
    const nextErrors: { scope?: string; rate?: string } = {};

    if (!isEdit && !scopeId) nextErrors.scope = "Selecione uma categoria ou produto.";
    else if (!isEdit) {
      const isDuplicate = overrides.some(
        (o) =>
          o.taxTypeId === overrideTaxTypeId &&
          o.scope === overrideScope &&
          (overrideScope === "category" ? o.categoryId === scopeId : o.productId === scopeId),
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

    setIsSavingOverride(true);
    try {
      if (overrideDialog?.mode === "edit") {
        // Só rate/note são editáveis — tributo, categoria e produto são a
        // identidade do override (trocar de escopo é excluir e criar de novo,
        // ver lib/tax-engine/actions.ts).
        const updated = await updateTaxRateOverrideAction(overrideDialog.override.id, {
          rate: parseRate(overrideRate),
          note: overrideNote.trim() || null,
        });
        setOverrides((current) => current.map((o) => (o.id === updated.id ? updated : o)));
        toast.success("Override atualizado.");
      } else {
        const created = await createTaxRateOverrideAction({
          taxTypeId: overrideTaxTypeId,
          scope: overrideScope,
          categoryId: overrideScope === "category" ? overrideCategoryId : null,
          productId: overrideScope === "product" ? overrideProductId : null,
          rate: parseRate(overrideRate),
          note: overrideNote.trim() || null,
        });
        setOverrides((current) => [...current, created]);
        toast.success("Override criado.");
      }
      setOverrideDialog(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar o override.";
      setOverrideErrors({ scope: message });
    } finally {
      setIsSavingOverride(false);
    }
  }

  async function handleDeleteOverride(override: TaxRateOverrideSetting) {
    try {
      await deleteTaxRateOverrideAction(override.id);
      setOverrides((current) => current.filter((o) => o.id !== override.id));
      toast.success("Override removido.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o override.");
    }
  }

  async function handleSaveSettings() {
    setIsSavingSettings(true);
    try {
      await updateTaxSettingsAction({
        documentFooter: documentFooter.trim() || null,
        showTaxLines,
      });
      toast.success("Configuração do documento salva.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      );
    } finally {
      setIsSavingSettings(false);
    }
  }

  /**
   * UF de origem da organização (Bloco 3b) — organizações que não passaram
   * pelo onboarding com esse campo completam aqui. Alimenta a resolução de
   * ICMS-ST por UF (origem × destino, Bloco 4) — este bloco só garante que o
   * dado existe e é editável, não decide como o Bloco 4 vai usá-lo.
   */
  async function handleSaveOrganizationState() {
    setIsSavingOrganizationState(true);
    try {
      await updateOrganizationStateAction(organizationState.trim() || null);
      toast.success("UF de origem salva.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a UF.");
    } finally {
      setIsSavingOrganizationState(false);
    }
  }

  /**
   * Troca de regime é SEMPRE metadado isolado — não toca tax_types/tax_rates/
   * tax_settings aqui. Reaplicar o preset é uma ação separada, só depois de
   * confirmação explícita (ver handleApplyPreset), decisão registrada em
   * decisoes-registradas.md, "Regime Tributário" #3.
   */
  async function handleChangeRegime(next: string) {
    const nextRegime = next as TaxRegime;
    setIsChangingRegime(true);
    try {
      await updateOrganizationRegimeAction(nextRegime);
      setTaxRegime(nextRegime);
      toast.success(`Regime Tributário alterado para ${TAX_REGIME_LABELS[nextRegime]}.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível gravar o regime tributário.",
      );
    } finally {
      setIsChangingRegime(false);
    }
  }

  async function handleApplyPreset() {
    if (!taxRegime) return;
    setIsApplyingPreset(true);
    try {
      const result = await applyRegimeTemplateAction(taxRegime, applyIcmsRate);
      setTaxTypes(result.taxTypes);
      setOverrides([]);
      setDocumentFooter(result.documentFooter ?? "");
      setShowTaxLines(result.showTaxLines);
      toast.success(`Preset padrão de ${TAX_REGIME_LABELS[taxRegime]} aplicado.`);
      setApplyDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível aplicar o preset do regime.",
      );
    } finally {
      setIsApplyingPreset(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Regime Tributário</CardTitle>
          <CardDescription>
            Determina o preset inicial sugerido — o motor de cálculo nunca lê o regime, só a
            configuração abaixo (briefing §6).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Regime atual:</span>
            <Select
              value={taxRegime ?? undefined}
              onValueChange={(value) => value && handleChangeRegime(value)}
              disabled={isChangingRegime}
            >
              <SelectTrigger className="w-56">
                <SelectValue>
                  {(value: string) => TAX_REGIME_LABELS[value as TaxRegime] ?? "Não confirmado"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TAX_REGIMES.map((regime) => (
                  <SelectItem key={regime} value={regime}>
                    {TAX_REGIME_LABELS[regime]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" disabled={!taxRegime} />}>
                Aplicar preset padrão deste regime
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Aplicar preset de {regimeLabel}</DialogTitle>
                  <DialogDescription>
                    Isso substitui os {taxTypes.length} tributo(s) e {overrides.length} override(s)
                    configurados agora — não acumula com o que já existe. Sugestão inicial, editável
                    depois nesta mesma tela; confirme com o contador antes de emitir orçamento com
                    valor oficial.
                  </DialogDescription>
                </DialogHeader>

                {applyPreviewPlan && applyPreviewPlan.taxTypes.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="apply-icms-rate" className="text-sm font-medium">
                        ICMS padrão (%)
                      </label>
                      <Input
                        id="apply-icms-rate"
                        inputMode="decimal"
                        value={applyIcmsRate}
                        onChange={(event) => setApplyIcmsRate(event.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="bg-muted/30 rounded-lg border border-dashed p-3 text-sm">
                      <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                        Prévia do que será gravado
                      </p>
                      {applyPreviewPlan.taxTypes.map((taxType) => (
                        <div key={taxType.code} className="flex items-baseline justify-between">
                          <span>
                            {taxType.label} (
                            {taxType.mode === "inclusive" ? "embutido no preço" : "somado por fora"}
                            )
                          </span>
                          <span className="font-mono tabular-nums">{taxType.defaultRate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nenhum tributo — só o rodapé informativo da Lei 12.741/2012.
                  </p>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleApplyPreset}
                    disabled={isApplyingPreset}
                  >
                    Substituir configuração atual
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {!taxRegime ? (
            <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-sm">
              Regime Tributário ainda não confirmado — escolha um acima ou refaça o onboarding.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Ponto de partida editável, nunca regra travada (briefing §9): o preset
          do regime tributário sugere tributo, modo e alíquota, mas quem confirma
          se aquilo é o certo pra esta organização é o contador dela — o sistema
          não valida a legislação em si, só congela o que foi configurado. */}
      <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-sm">
        Estes tributos e alíquotas são um ponto de partida sugerido pelo regime tributário da
        organização — não são verdade fiscal. Confirme com o contador da organização quais tributos
        realmente incidem, o modo de cálculo e a alíquota de cada um antes de emitir orçamentos com
        valor oficial.
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

              {taxTypeDialog?.mode === "create" && regimeSemDestaque ? (
                <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-sm">
                  Regime {regimeLabel} normalmente não destaca tributo no orçamento — confirme com o
                  contador que isso é necessário antes de usar em orçamento com valor oficial.
                </div>
              ) : null}

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
                <Button onClick={handleSaveTaxType} disabled={isSavingTaxType}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {taxTypes.length === 0 ? (
            <EmptyState
              title="Nenhum tributo cadastrado"
              description={
                regimeSemDestaque
                  ? `Regime ${regimeLabel} não destaca tributo por padrão — isso é esperado, não um estado a corrigir. Adicione um tributo aqui só se sua atividade específica exigir, e confirme com o contador.`
                  : "Organização sem tributo destacado é configuração válida — crie um tributo aqui quando precisar destacar imposto no orçamento."
              }
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
                  {overrideDialog?.mode === "edit"
                    ? "Tributo e escopo não mudam aqui — para outro escopo, exclua e crie um novo override."
                    : "Escolha exatamente um escopo — categoria ou produto — para esse tributo."}
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
                    disabled={overrideDialog?.mode === "edit"}
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
                      disabled={overrideDialog?.mode === "edit"}
                      onClick={() => setOverrideScope("category")}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
                      disabled={overrideDialog?.mode === "edit"}
                      onClick={() => setOverrideScope("product")}
                      className={cn(
                        "border-input border-l px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
                      disabled={overrideDialog?.mode === "edit"}
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
                      disabled={overrideDialog?.mode === "edit"}
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
                <Button onClick={handleSaveOverride} disabled={isSavingOverride}>
                  Salvar
                </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>UF de origem</CardTitle>
          <CardDescription>
            Estado onde a organização emite os orçamentos — usado para resolver ICMS-ST por estado.
            Preenchido automaticamente por quem passou pelo onboarding via CNPJ; quem não passou
            completa aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="organization-state" className="text-sm font-medium">
              UF
            </label>
            <Input
              id="organization-state"
              value={organizationState}
              maxLength={2}
              onChange={(event) => setOrganizationState(event.target.value.toUpperCase())}
              placeholder="Ex.: SP"
              className="w-20 uppercase"
            />
          </div>
          <div>
            <Button
              size="sm"
              onClick={handleSaveOrganizationState}
              disabled={isSavingOrganizationState}
            >
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ICMS-ST por estado</CardTitle>
          <CardDescription>
            Alíquota manual por categoria e UF de destino — configuração fora da hierarquia
            padrão/categoria/produto acima, feita numa tela própria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" render={<Link href="/settings/taxes/icms-st" />}>
            Configurar ICMS-ST por estado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documento</CardTitle>
          <CardDescription>
            Rodapé informativo e se as linhas de imposto aparecem no orçamento — copiado para o
            documento no momento da emissão.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="document-footer" className="text-sm font-medium">
              Texto do rodapé
            </label>
            <textarea
              id="document-footer"
              rows={2}
              value={documentFooter}
              onChange={(event) => setDocumentFooter(event.target.value)}
              placeholder="Ex.: Valor aproximado dos tributos incidentes conforme Lei 12.741/2012."
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Mostrar linha de imposto no orçamento</span>
            <div className="border-input inline-flex w-fit overflow-hidden rounded-lg border">
              <button
                type="button"
                aria-pressed={showTaxLines}
                onClick={() => setShowTaxLines(true)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  showTaxLines ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                Sim
              </button>
              <button
                type="button"
                aria-pressed={!showTaxLines}
                onClick={() => setShowTaxLines(false)}
                className={cn(
                  "border-input border-l px-2.5 py-1 text-xs font-medium transition-colors",
                  !showTaxLines ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                Não
              </button>
            </div>
          </div>

          <div>
            <Button size="sm" onClick={handleSaveSettings} disabled={isSavingSettings}>
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
