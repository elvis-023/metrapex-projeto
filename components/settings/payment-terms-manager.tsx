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
import { currencyFormatter } from "@/lib/catalog/format";
import type { PaymentCondition, PaymentMethodKind, PaymentValueBand } from "@/lib/settings/types";

const kindLabels: Record<PaymentMethodKind, string> = {
  a_vista: "À vista",
  cartao: "Cartão de crédito",
  boleto: "Boleto",
};

function isValidNumber(value: string): boolean {
  return /^\d+([.,]\d{1,2})?$/.test(value.trim());
}

function parseNumber(value: string): number {
  return Number(value.trim().replace(",", "."));
}

type ConditionDialogState =
  { mode: "create" } | { mode: "edit"; condition: PaymentCondition } | null;
type BandDialogState = { mode: "create" } | { mode: "edit"; band: PaymentValueBand } | null;

export function PaymentTermsManager({
  initialConditions,
  initialBands,
}: {
  initialConditions: PaymentCondition[];
  initialBands: PaymentValueBand[];
}) {
  const [conditions, setConditions] = useState(initialConditions);
  const [bands, setBands] = useState(initialBands);

  const [conditionDialog, setConditionDialog] = useState<ConditionDialogState>(null);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<PaymentMethodKind>("a_vista");
  const [discountPercent, setDiscountPercent] = useState("");
  const [installments, setInstallments] = useState("1");
  const [termDays, setTermDays] = useState("0");
  const [conditionErrors, setConditionErrors] = useState<{
    label?: string;
    discount?: string;
    installments?: string;
    term?: string;
  }>({});

  const [bandDialog, setBandDialog] = useState<BandDialogState>(null);
  const [bandLabel, setBandLabel] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [selectedConditionIds, setSelectedConditionIds] = useState<string[]>([]);
  const [bandErrors, setBandErrors] = useState<{
    label?: string;
    range?: string;
    conditions?: string;
  }>({});

  function openCreateCondition() {
    setConditionDialog({ mode: "create" });
    setLabel("");
    setKind("a_vista");
    setDiscountPercent("");
    setInstallments("1");
    setTermDays("0");
    setConditionErrors({});
  }

  function openEditCondition(condition: PaymentCondition) {
    setConditionDialog({ mode: "edit", condition });
    setLabel(condition.label);
    setKind(condition.kind);
    setDiscountPercent(
      condition.discountPercent ? String(condition.discountPercent).replace(".", ",") : "",
    );
    setInstallments(String(condition.installments));
    setTermDays(String(condition.termDays));
    setConditionErrors({});
  }

  function handleSaveCondition() {
    const trimmedLabel = label.trim();
    const nextErrors: typeof conditionErrors = {};

    if (!trimmedLabel) nextErrors.label = "Nome obrigatório.";
    if (discountPercent.trim() && !isValidNumber(discountPercent)) {
      nextErrors.discount = "Use vírgula para casas decimais (ex.: 5,00).";
    }
    if (!installments.trim() || !/^\d+$/.test(installments) || Number(installments) < 1) {
      nextErrors.installments = "Número de parcelas inválido.";
    }
    if (!termDays.trim() || !/^\d+$/.test(termDays)) {
      nextErrors.term = "Prazo em dias inválido.";
    }

    setConditionErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      label: trimmedLabel,
      kind,
      discountPercent: discountPercent.trim() ? parseNumber(discountPercent) : 0,
      installments: Number(installments),
      termDays: Number(termDays),
      active: true,
    };

    if (conditionDialog?.mode === "edit") {
      setConditions((current) =>
        current.map((c) =>
          c.id === conditionDialog.condition.id ? { ...c, ...payload, active: c.active } : c,
        ),
      );
      toast.success("Condição de pagamento atualizada.");
    } else {
      setConditions((current) => [...current, { id: `cond_${crypto.randomUUID()}`, ...payload }]);
      toast.success("Condição de pagamento criada.");
    }
    setConditionDialog(null);
  }

  function toggleConditionActive(condition: PaymentCondition) {
    setConditions((current) =>
      current.map((c) => (c.id === condition.id ? { ...c, active: !c.active } : c)),
    );
  }

  function handleDeleteCondition(condition: PaymentCondition) {
    const dependentBands = bands.filter((band) => band.paymentConditionIds.includes(condition.id));
    if (dependentBands.length > 0) {
      toast.error(
        `Remova esta condição das ${dependentBands.length} faixa(s) de valor que a usam antes de excluí-la.`,
      );
      return;
    }
    setConditions((current) => current.filter((c) => c.id !== condition.id));
    toast.success("Condição de pagamento removida.");
  }

  function openCreateBand() {
    setBandDialog({ mode: "create" });
    setBandLabel("");
    setMinValue("");
    setMaxValue("");
    setSelectedConditionIds([]);
    setBandErrors({});
  }

  function openEditBand(band: PaymentValueBand) {
    setBandDialog({ mode: "edit", band });
    setBandLabel(band.label);
    setMinValue(String(band.minValue).replace(".", ","));
    setMaxValue(band.maxValue === null ? "" : String(band.maxValue).replace(".", ","));
    setSelectedConditionIds(band.paymentConditionIds);
    setBandErrors({});
  }

  function handleSaveBand() {
    const trimmedLabel = bandLabel.trim();
    const nextErrors: typeof bandErrors = {};

    if (!trimmedLabel) nextErrors.label = "Nome da faixa obrigatório.";
    if (!minValue.trim() || !isValidNumber(minValue)) {
      nextErrors.range = "Valor mínimo obrigatório e numérico.";
    } else if (
      maxValue.trim() &&
      isValidNumber(maxValue) &&
      parseNumber(maxValue) <= parseNumber(minValue)
    ) {
      nextErrors.range = "Valor máximo deve ser maior que o mínimo.";
    } else if (maxValue.trim() && !isValidNumber(maxValue)) {
      nextErrors.range = "Valor máximo mal formatado.";
    } else {
      const candidateMin = parseNumber(minValue);
      const candidateMax = maxValue.trim() ? parseNumber(maxValue) : null;
      const overlapping = bands.find((band) => {
        if (bandDialog?.mode === "edit" && band.id === bandDialog.band.id) return false;
        const bandMax = band.maxValue ?? Infinity;
        const candidateMaxOrInfinity = candidateMax ?? Infinity;
        return candidateMin < bandMax && band.minValue < candidateMaxOrInfinity;
      });
      if (overlapping) {
        nextErrors.range = `Sobrepõe a faixa "${overlapping.label}" (${currencyFormatter.format(overlapping.minValue)} – ${overlapping.maxValue === null ? "sem teto" : currencyFormatter.format(overlapping.maxValue)}). Ajuste os limites para as faixas não se sobreporem.`;
      }
    }
    if (selectedConditionIds.length === 0) {
      nextErrors.conditions = "Selecione ao menos uma condição de pagamento.";
    }

    setBandErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      label: trimmedLabel,
      minValue: parseNumber(minValue),
      maxValue: maxValue.trim() ? parseNumber(maxValue) : null,
      paymentConditionIds: selectedConditionIds,
    };

    if (bandDialog?.mode === "edit") {
      setBands((current) =>
        current.map((b) => (b.id === bandDialog.band.id ? { ...b, ...payload } : b)),
      );
      toast.success("Faixa de valor atualizada.");
    } else {
      setBands((current) => [...current, { id: `band_${crypto.randomUUID()}`, ...payload }]);
      toast.success("Faixa de valor criada.");
    }
    setBandDialog(null);
  }

  function handleDeleteBand(band: PaymentValueBand) {
    setBands((current) => current.filter((b) => b.id !== band.id));
    toast.success("Faixa de valor removida.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Condições de pagamento</CardTitle>
            <CardDescription>
              Formas de pagamento cadastráveis com desconto, parcelas e prazo.
            </CardDescription>
          </div>
          <Dialog
            open={conditionDialog !== null}
            onOpenChange={(open) => !open && setConditionDialog(null)}
          >
            <DialogTrigger render={<Button size="sm" onClick={openCreateCondition} />}>
              <PlusIcon />
              Nova condição
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {conditionDialog?.mode === "edit" ? "Editar condição" : "Nova condição"}
                </DialogTitle>
                <DialogDescription>
                  Forma de pagamento disponível para os vendedores.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label htmlFor="condition-label" className="text-sm font-medium">
                      Nome
                    </label>
                    <Input
                      id="condition-label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      aria-invalid={Boolean(conditionErrors.label)}
                      className={cn(conditionErrors.label && "border-destructive")}
                    />
                    {conditionErrors.label ? (
                      <p className="text-destructive text-sm">{conditionErrors.label}</p>
                    ) : null}
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label htmlFor="condition-kind" className="text-sm font-medium">
                      Tipo
                    </label>
                    <Select
                      value={kind}
                      onValueChange={(value) => value && setKind(value as PaymentMethodKind)}
                    >
                      <SelectTrigger id="condition-kind" className="w-full">
                        <SelectValue>
                          {(value: string) => kindLabels[value as PaymentMethodKind]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_vista">À vista</SelectItem>
                        <SelectItem value="cartao">Cartão de crédito</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="condition-discount" className="text-sm font-medium">
                      Desconto (%)
                    </label>
                    <Input
                      id="condition-discount"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={discountPercent}
                      onChange={(event) => setDiscountPercent(event.target.value)}
                      aria-invalid={Boolean(conditionErrors.discount)}
                      className={cn(
                        "tabular-nums",
                        conditionErrors.discount && "border-destructive",
                      )}
                    />
                    {conditionErrors.discount ? (
                      <p className="text-destructive text-sm">{conditionErrors.discount}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="condition-installments" className="text-sm font-medium">
                      Parcelas
                    </label>
                    <Input
                      id="condition-installments"
                      inputMode="numeric"
                      value={installments}
                      onChange={(event) => setInstallments(event.target.value)}
                      aria-invalid={Boolean(conditionErrors.installments)}
                      className={cn(
                        "tabular-nums",
                        conditionErrors.installments && "border-destructive",
                      )}
                    />
                    {conditionErrors.installments ? (
                      <p className="text-destructive text-sm">{conditionErrors.installments}</p>
                    ) : null}
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label htmlFor="condition-term" className="text-sm font-medium">
                      Prazo de vencimento (dias, 0 = imediato)
                    </label>
                    <Input
                      id="condition-term"
                      inputMode="numeric"
                      value={termDays}
                      onChange={(event) => setTermDays(event.target.value)}
                      aria-invalid={Boolean(conditionErrors.term)}
                      className={cn("tabular-nums", conditionErrors.term && "border-destructive")}
                    />
                    {conditionErrors.term ? (
                      <p className="text-destructive text-sm">{conditionErrors.term}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConditionDialog(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCondition}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {conditions.length === 0 ? (
            <EmptyState
              title="Nenhuma condição cadastrada"
              description="Crie ao menos uma condição de pagamento para usar no orçamento manual e no formulário público."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="text-right">Prazo</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {conditions.map((condition) => (
                  <TableRow key={condition.id} className={cn(!condition.active && "opacity-60")}>
                    <TableCell className="font-medium">{condition.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{kindLabels[condition.kind]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {condition.discountPercent > 0 ? `${condition.discountPercent}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {condition.installments}x
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {condition.termDays === 0 ? "Imediato" : `${condition.termDays} dias`}
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={condition.active}
                          onChange={() => toggleConditionActive(condition)}
                          className="accent-primary size-4 rounded-[calc(var(--radius)-2px)]"
                          aria-label={`Condição ${condition.label} ativa`}
                        />
                      </label>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar condição"
                          onClick={() => openEditCondition(condition)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir condição"
                          onClick={() => handleDeleteCondition(condition)}
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
            <CardTitle>Faixas de valor</CardTitle>
            <CardDescription>
              Definem quais condições de pagamento se aplicam a cada faixa de valor do orçamento.
            </CardDescription>
          </div>
          <Dialog open={bandDialog !== null} onOpenChange={(open) => !open && setBandDialog(null)}>
            <DialogTrigger
              render={
                <Button size="sm" onClick={openCreateBand} disabled={conditions.length === 0} />
              }
            >
              <PlusIcon />
              Nova faixa
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {bandDialog?.mode === "edit" ? "Editar faixa" : "Nova faixa"}
                </DialogTitle>
                <DialogDescription>
                  Faixa aplicada ao valor total do orçamento antes do desconto negociado.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="band-label" className="text-sm font-medium">
                    Nome
                  </label>
                  <Input
                    id="band-label"
                    value={bandLabel}
                    onChange={(event) => setBandLabel(event.target.value)}
                    aria-invalid={Boolean(bandErrors.label)}
                    className={cn(bandErrors.label && "border-destructive")}
                  />
                  {bandErrors.label ? (
                    <p className="text-destructive text-sm">{bandErrors.label}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="band-min" className="text-sm font-medium">
                      Valor mínimo (R$)
                    </label>
                    <Input
                      id="band-min"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={minValue}
                      onChange={(event) => setMinValue(event.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="band-max" className="text-sm font-medium">
                      Valor máximo (R$, vazio = sem teto)
                    </label>
                    <Input
                      id="band-max"
                      inputMode="decimal"
                      placeholder="Sem teto"
                      value={maxValue}
                      onChange={(event) => setMaxValue(event.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                </div>
                {bandErrors.range ? (
                  <p className="text-destructive text-sm">{bandErrors.range}</p>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Condições de pagamento aplicáveis</span>
                  <div className="flex flex-col gap-1.5">
                    {conditions.map((condition) => (
                      <label key={condition.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedConditionIds.includes(condition.id)}
                          onChange={(event) =>
                            setSelectedConditionIds((current) =>
                              event.target.checked
                                ? [...current, condition.id]
                                : current.filter((id) => id !== condition.id),
                            )
                          }
                          className="accent-primary size-4 rounded-[calc(var(--radius)-2px)]"
                        />
                        {condition.label}
                      </label>
                    ))}
                  </div>
                  {bandErrors.conditions ? (
                    <p className="text-destructive text-sm">{bandErrors.conditions}</p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBandDialog(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveBand}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {bands.length === 0 ? (
            <EmptyState
              title="Nenhuma faixa cadastrada"
              description="Sem faixas, todas as condições ficam disponíveis para qualquer valor de orçamento."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Condições aplicáveis</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bands.map((band) => (
                  <TableRow key={band.id}>
                    <TableCell className="font-medium">{band.label}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {currencyFormatter.format(band.minValue)} —{" "}
                      {band.maxValue === null
                        ? "sem teto"
                        : currencyFormatter.format(band.maxValue)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {band.paymentConditionIds.map((id) => {
                          const condition = conditions.find((c) => c.id === id);
                          return condition ? (
                            <Badge key={id} variant="secondary">
                              {condition.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar faixa"
                          onClick={() => openEditBand(band)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir faixa"
                          onClick={() => handleDeleteBand(band)}
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
    </div>
  );
}
