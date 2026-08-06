"use client";

import { useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";
import type { ProductCategory } from "@/lib/catalog/types";
import {
  createIcmsStStateRuleAction,
  deleteIcmsStStateRuleAction,
  updateIcmsStStateRuleAction,
} from "@/lib/tax-engine/icms-st-actions";
import { BRAZILIAN_STATES } from "@/lib/tax-engine/icms-st-types";
import type { IcmsStStateRule, IcmsStStateRuleInput } from "@/lib/tax-engine/icms-st-types";

function isValidRate(value: string): boolean {
  return /^\d+([.,]\d{1,4})?$/.test(value.trim());
}

function parseRate(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function formatRate(value: number): string {
  return String(value).replace(".", ",");
}

type FormValues = {
  icmsContribuinteRate: string;
  icmsNaoContribuinteRate: string;
  icmsReducaoBase: string;
  stContribuinteRate: string;
  stNaoContribuinteRate: string;
  ivaSimples: string;
  ivaNormal: string;
  fcpComercializacao: string;
  fcpConsumo: string;
  fcpStComercializacao: string;
  fcpStConsumo: string;
  cstComercializacao: string;
  cstConsumo: string;
  codigoBeneficio: string;
  decretoContribuinte: string;
  decretoNaoContribuinte: string;
  note: string;
};

const EMPTY_FORM: FormValues = {
  icmsContribuinteRate: "",
  icmsNaoContribuinteRate: "",
  icmsReducaoBase: "",
  stContribuinteRate: "",
  stNaoContribuinteRate: "",
  ivaSimples: "",
  ivaNormal: "",
  fcpComercializacao: "",
  fcpConsumo: "",
  fcpStComercializacao: "",
  fcpStConsumo: "",
  cstComercializacao: "",
  cstConsumo: "",
  codigoBeneficio: "",
  decretoContribuinte: "",
  decretoNaoContribuinte: "",
  note: "",
};

function ruleToForm(rule: IcmsStStateRule): FormValues {
  return {
    icmsContribuinteRate: formatRate(rule.icmsContribuinteRate),
    icmsNaoContribuinteRate: formatRate(rule.icmsNaoContribuinteRate),
    icmsReducaoBase: formatRate(rule.icmsReducaoBase),
    stContribuinteRate: formatRate(rule.stContribuinteRate),
    stNaoContribuinteRate: formatRate(rule.stNaoContribuinteRate),
    ivaSimples: rule.ivaSimples === null ? "" : formatRate(rule.ivaSimples),
    ivaNormal: rule.ivaNormal === null ? "" : formatRate(rule.ivaNormal),
    fcpComercializacao: formatRate(rule.fcpComercializacao),
    fcpConsumo: formatRate(rule.fcpConsumo),
    fcpStComercializacao: formatRate(rule.fcpStComercializacao),
    fcpStConsumo: formatRate(rule.fcpStConsumo),
    cstComercializacao: rule.cstComercializacao ?? "",
    cstConsumo: rule.cstConsumo ?? "",
    codigoBeneficio: rule.codigoBeneficio ?? "",
    decretoContribuinte: rule.decretoContribuinte ?? "",
    decretoNaoContribuinte: rule.decretoNaoContribuinte ?? "",
    note: rule.note ?? "",
  };
}

/** Campos de alíquota obrigatórios — sem default no banco (Bloco 1). */
const REQUIRED_RATE_FIELDS = [
  "icmsContribuinteRate",
  "icmsNaoContribuinteRate",
  "stContribuinteRate",
  "stNaoContribuinteRate",
] as const;

/** Campos de alíquota opcionais, default 0 quando em branco (mesmo default do banco). */
const OPTIONAL_ZERO_RATE_FIELDS = [
  "icmsReducaoBase",
  "fcpComercializacao",
  "fcpConsumo",
  "fcpStComercializacao",
  "fcpStConsumo",
] as const;

/** Referência/auditoria — em branco vira null, nunca 0 (§8: motor não calcula MVA). */
const OPTIONAL_NULL_RATE_FIELDS = ["ivaSimples", "ivaNormal"] as const;

function buildInput(categoryId: string, uf: string, form: FormValues): IcmsStStateRuleInput {
  return {
    categoryId,
    uf,
    icmsContribuinteRate: parseRate(form.icmsContribuinteRate),
    icmsNaoContribuinteRate: parseRate(form.icmsNaoContribuinteRate),
    icmsReducaoBase: form.icmsReducaoBase.trim() ? parseRate(form.icmsReducaoBase) : 0,
    stContribuinteRate: parseRate(form.stContribuinteRate),
    stNaoContribuinteRate: parseRate(form.stNaoContribuinteRate),
    ivaSimples: form.ivaSimples.trim() ? parseRate(form.ivaSimples) : null,
    ivaNormal: form.ivaNormal.trim() ? parseRate(form.ivaNormal) : null,
    fcpComercializacao: form.fcpComercializacao.trim() ? parseRate(form.fcpComercializacao) : 0,
    fcpConsumo: form.fcpConsumo.trim() ? parseRate(form.fcpConsumo) : 0,
    fcpStComercializacao: form.fcpStComercializacao.trim()
      ? parseRate(form.fcpStComercializacao)
      : 0,
    fcpStConsumo: form.fcpStConsumo.trim() ? parseRate(form.fcpStConsumo) : 0,
    cstComercializacao: form.cstComercializacao.trim() || null,
    cstConsumo: form.cstConsumo.trim() || null,
    codigoBeneficio: form.codigoBeneficio.trim() || null,
    decretoContribuinte: form.decretoContribuinte.trim() || null,
    decretoNaoContribuinte: form.decretoNaoContribuinte.trim() || null,
    note: form.note.trim() || null,
  };
}

function RateField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={cn("tabular-nums", error && "border-destructive")}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function IcmsStManager({
  categories,
  initialRules,
}: {
  categories: ProductCategory[];
  initialRules: IcmsStStateRule[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [dialogUf, setDialogUf] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [rateErrors, setRateErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const rulesByUf = useMemo(() => {
    const map = new Map<string, IcmsStStateRule>();
    for (const rule of rules) {
      if (rule.categoryId === categoryId) map.set(rule.uf, rule);
    }
    return map;
  }, [rules, categoryId]);

  const configuredCount = rulesByUf.size;
  const existingRule = dialogUf ? rulesByUf.get(dialogUf) : undefined;

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openUf(uf: string) {
    const rule = rulesByUf.get(uf);
    setDialogUf(uf);
    setForm(rule ? ruleToForm(rule) : EMPTY_FORM);
    setRateErrors({});
    setFormError(null);
  }

  function closeDialog() {
    setDialogUf(null);
  }

  async function handleSave() {
    if (!dialogUf) return;

    const nextErrors: Partial<Record<keyof FormValues, string>> = {};
    for (const field of REQUIRED_RATE_FIELDS) {
      if (!form[field].trim()) nextErrors[field] = "Obrigatório.";
      else if (!isValidRate(form[field])) nextErrors[field] = "Use vírgula (ex.: 18,00).";
    }
    for (const field of [...OPTIONAL_ZERO_RATE_FIELDS, ...OPTIONAL_NULL_RATE_FIELDS]) {
      if (form[field].trim() && !isValidRate(form[field])) {
        nextErrors[field] = "Use vírgula (ex.: 18,00).";
      }
    }
    setRateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = buildInput(categoryId, dialogUf, form);
    setIsSaving(true);
    setFormError(null);
    try {
      if (existingRule) {
        const updated = await updateIcmsStStateRuleAction(existingRule.id, input);
        setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)));
        toast.success(`Regra de ${dialogUf} atualizada.`);
      } else {
        const created = await createIcmsStStateRuleAction(input);
        setRules((current) => [...current, created]);
        toast.success(`Regra de ${dialogUf} criada.`);
      }
      closeDialog();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a regra.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingRule) return;
    setIsDeleting(true);
    try {
      await deleteIcmsStStateRuleAction(existingRule.id);
      setRules((current) => current.filter((rule) => rule.id !== existingRule.id));
      toast.success(`Regra de ${existingRule.uf} removida.`);
      closeDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a regra.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        title="Nenhuma categoria cadastrada"
        description="Crie uma categoria em Catálogo → Categorias (com NCM) antes de configurar ICMS-ST por estado."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">ICMS-ST por estado</h1>
        <p className="text-muted-foreground text-sm">
          Configuração manual por categoria e UF — o motor não calcula MVA/pauta fiscal
          automaticamente (fora de escopo do V1); as alíquotas abaixo são as que a organização (ou o
          contador dela) já apurou.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 sm:w-72">
        <label htmlFor="icms-st-category" className="text-sm font-medium">
          Categoria
        </label>
        <Select value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
          <SelectTrigger id="icms-st-category" className="w-full">
            <SelectValue>
              {() => categories.find((category) => category.id === categoryId)?.name ?? ""}
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

      <Card>
        <CardHeader>
          <CardTitle>Estados configurados</CardTitle>
          <CardDescription>
            {configuredCount} de 27 UFs com regra cadastrada para esta categoria. Clique numa UF
            para criar ou editar; UF sem regra não bloqueia orçamento nem cálculo — só significa que
            ainda não foi configurada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-9">
            {BRAZILIAN_STATES.map(({ uf, name }) => {
              const configured = rulesByUf.has(uf);
              return (
                <button
                  key={uf}
                  type="button"
                  title={name}
                  onClick={() => openUf(uf)}
                  aria-pressed={configured}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    configured
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="tabular-nums">{uf}</span>
                  {configured ? (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      Configurada
                    </Badge>
                  ) : (
                    <span className="text-[10px]">Pendente</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogUf !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {existingRule ? "Editar" : "Nova"} regra de ICMS-ST — {dialogUf}
            </DialogTitle>
            <DialogDescription>
              {categories.find((category) => category.id === categoryId)?.name} · UF {dialogUf}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Alíquotas</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RateField
                  id="icms-contribuinte-rate"
                  label="ICMS contribuinte (%)"
                  value={form.icmsContribuinteRate}
                  onChange={(value) => setField("icmsContribuinteRate", value)}
                  error={rateErrors.icmsContribuinteRate}
                />
                <RateField
                  id="icms-nao-contribuinte-rate"
                  label="ICMS não contribuinte (%)"
                  value={form.icmsNaoContribuinteRate}
                  onChange={(value) => setField("icmsNaoContribuinteRate", value)}
                  error={rateErrors.icmsNaoContribuinteRate}
                />
                <RateField
                  id="icms-reducao-base"
                  label="Redução de base ICMS (%)"
                  value={form.icmsReducaoBase}
                  onChange={(value) => setField("icmsReducaoBase", value)}
                  error={rateErrors.icmsReducaoBase}
                />
                <RateField
                  id="st-contribuinte-rate"
                  label="ST contribuinte (%)"
                  value={form.stContribuinteRate}
                  onChange={(value) => setField("stContribuinteRate", value)}
                  error={rateErrors.stContribuinteRate}
                />
                <RateField
                  id="st-nao-contribuinte-rate"
                  label="ST não contribuinte (%)"
                  value={form.stNaoContribuinteRate}
                  onChange={(value) => setField("stNaoContribuinteRate", value)}
                  error={rateErrors.stNaoContribuinteRate}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Referência (IVA)</h3>
              <p className="text-muted-foreground -mt-1 text-xs">
                Cadastro para auditoria do contador — o motor não calcula a partir destes valores,
                só aplica a alíquota final de ST acima.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RateField
                  id="iva-simples"
                  label="IVA-ST — origem Simples (%)"
                  value={form.ivaSimples}
                  onChange={(value) => setField("ivaSimples", value)}
                  error={rateErrors.ivaSimples}
                />
                <RateField
                  id="iva-normal"
                  label="IVA-ST — origem normal (%)"
                  value={form.ivaNormal}
                  onChange={(value) => setField("ivaNormal", value)}
                  error={rateErrors.ivaNormal}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">FCP</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RateField
                  id="fcp-comercializacao"
                  label="FCP comercialização (%)"
                  value={form.fcpComercializacao}
                  onChange={(value) => setField("fcpComercializacao", value)}
                  error={rateErrors.fcpComercializacao}
                />
                <RateField
                  id="fcp-consumo"
                  label="FCP consumo (%)"
                  value={form.fcpConsumo}
                  onChange={(value) => setField("fcpConsumo", value)}
                  error={rateErrors.fcpConsumo}
                />
                <RateField
                  id="fcp-st-comercializacao"
                  label="FCP-ST comercialização (%)"
                  value={form.fcpStComercializacao}
                  onChange={(value) => setField("fcpStComercializacao", value)}
                  error={rateErrors.fcpStComercializacao}
                />
                <RateField
                  id="fcp-st-consumo"
                  label="FCP-ST consumo (%)"
                  value={form.fcpStConsumo}
                  onChange={(value) => setField("fcpStConsumo", value)}
                  error={rateErrors.fcpStConsumo}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Metadado</h3>
              <p className="text-muted-foreground -mt-1 text-xs">
                Sem uso em cálculo — só para o contador auditar/reimprimir.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  id="cst-comercializacao"
                  label="CST comercialização"
                  value={form.cstComercializacao}
                  onChange={(value) => setField("cstComercializacao", value)}
                />
                <TextField
                  id="cst-consumo"
                  label="CST consumo"
                  value={form.cstConsumo}
                  onChange={(value) => setField("cstConsumo", value)}
                />
                <TextField
                  id="codigo-beneficio"
                  label="Código de benefício"
                  value={form.codigoBeneficio}
                  onChange={(value) => setField("codigoBeneficio", value)}
                />
                <TextField
                  id="decreto-contribuinte"
                  label="Decreto — contribuinte"
                  value={form.decretoContribuinte}
                  onChange={(value) => setField("decretoContribuinte", value)}
                />
                <TextField
                  id="decreto-nao-contribuinte"
                  label="Decreto — não contribuinte"
                  value={form.decretoNaoContribuinte}
                  onChange={(value) => setField("decretoNaoContribuinte", value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="icms-st-note" className="text-sm font-medium">
                Observação
              </label>
              <textarea
                id="icms-st-note"
                rows={2}
                value={form.note}
                onChange={(event) => setField("note", event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
              />
            </div>

            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            {existingRule ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? "Excluindo..." : "Excluir regra"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
