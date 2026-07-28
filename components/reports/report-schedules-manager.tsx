"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { fakeCustomerSources } from "@/lib/customers/mock-data";
import {
  createReportScheduleAction,
  deleteReportScheduleAction,
  toggleReportScheduleAction,
  type ReportScheduleActionInput,
} from "@/lib/reports/actions";
import {
  frequencyLabels,
  prebuiltReportLabel,
  prebuiltReports,
  type ReportSchedule,
} from "@/lib/reports/types";
import type { ReportFrequency } from "@/lib/supabase/types";

const ALL_VALUE = "__all__";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function emptyForm() {
  return {
    name: "",
    reportKey: prebuiltReports[0].key as string,
    frequency: "diario" as ReportFrequency,
    ownerId: ALL_VALUE,
    sourceId: ALL_VALUE,
    recipients: "",
  };
}

export function ReportSchedulesManager({
  initialSchedules,
  sellers,
}: {
  initialSchedules: ReportSchedule[];
  sellers: { id: string; name: string }[];
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openCreateDialog() {
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    const recipients = form.recipients
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter(Boolean);

    const input: ReportScheduleActionInput = {
      name: form.name || prebuiltReportLabel(form.reportKey),
      reportKey: form.reportKey,
      definition: {
        ...(form.ownerId !== ALL_VALUE ? { ownerId: form.ownerId } : {}),
        ...(form.sourceId !== ALL_VALUE ? { sourceId: form.sourceId } : {}),
      },
      frequency: form.frequency,
      recipients,
    };

    setIsSaving(true);
    try {
      const { id } = await createReportScheduleAction(input);
      setSchedules((current) => [
        {
          id,
          name: input.name,
          reportKey: input.reportKey,
          definition: input.definition,
          frequency: input.frequency,
          recipients: input.recipients,
          active: true,
          nextRunAt: new Date().toISOString(),
          lastSentAt: null,
        },
        ...current,
      ]);
      toast.success("Agendamento criado.");
      setOpen(false);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleActive(schedule: ReportSchedule) {
    const previous = schedules;
    const nextActive = !schedule.active;
    setSchedules((current) =>
      current.map((item) => (item.id === schedule.id ? { ...item, active: nextActive } : item)),
    );
    startTransition(async () => {
      try {
        await toggleReportScheduleAction(schedule.id, nextActive);
      } catch {
        setSchedules(previous);
        toast.error("Não foi possível atualizar o agendamento.");
      }
    });
  }

  function remove(schedule: ReportSchedule) {
    const previous = schedules;
    setSchedules((current) => current.filter((item) => item.id !== schedule.id));
    startTransition(async () => {
      try {
        await deleteReportScheduleAction(schedule.id);
        toast.success("Agendamento excluído.");
      } catch {
        setSchedules(previous);
        toast.error("Não foi possível excluir o agendamento.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Envios agendados</CardTitle>
          <CardDescription>
            Relatório pré-construído enviado por e-mail em CSV, na cadência escolhida — a janela do
            dado é sempre os últimos 1/7/30 dias (diário/semanal/mensal), a partir do envio.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
            <PlusIcon />
            Novo agendamento
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo agendamento</DialogTitle>
              <DialogDescription>
                Escolha o relatório, a frequência e quem recebe.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={form.name}
                  placeholder={prebuiltReportLabel(form.reportKey)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Relatório</label>
                <Select
                  value={form.reportKey}
                  onValueChange={(value) =>
                    value && setForm((current) => ({ ...current, reportKey: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{(value: string) => prebuiltReportLabel(value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {prebuiltReports.map((report) => (
                      <SelectItem key={report.key} value={report.key}>
                        {report.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Frequência</label>
                  <Select
                    value={form.frequency}
                    onValueChange={(value) =>
                      value &&
                      setForm((current) => ({ ...current, frequency: value as ReportFrequency }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string) => frequencyLabels[value as ReportFrequency]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Vendedor</label>
                  <Select
                    value={form.ownerId}
                    onValueChange={(value) =>
                      value && setForm((current) => ({ ...current, ownerId: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          value === ALL_VALUE
                            ? "Todos"
                            : (sellers.find((seller) => seller.id === value)?.name ?? "Todos")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                      {sellers.map((seller) => (
                        <SelectItem key={seller.id} value={seller.id}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Origem</label>
                <Select
                  value={form.sourceId}
                  onValueChange={(value) =>
                    value && setForm((current) => ({ ...current, sourceId: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === ALL_VALUE
                          ? "Todas"
                          : (fakeCustomerSources.find((source) => source.id === value)?.name ??
                            "Todas")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                    {fakeCustomerSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Destinatários</label>
                <Textarea
                  rows={2}
                  placeholder="um@empresa.com, outro@empresa.com"
                  value={form.recipients}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, recipients: event.target.value }))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Separe por vírgula, ponto e vírgula ou linha.
                </p>
              </div>

              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Criar agendamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <EmptyState
            title="Nenhum agendamento"
            description="Crie um envio agendado para receber um relatório periodicamente por e-mail."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Relatório</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Próximo envio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">{schedule.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {prebuiltReportLabel(schedule.reportKey)}
                  </TableCell>
                  <TableCell>{frequencyLabels[schedule.frequency]}</TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-48 truncate"
                    title={schedule.recipients.join(", ")}
                  >
                    {schedule.recipients.join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {dateFormatter.format(new Date(schedule.nextRunAt))}
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => toggleActive(schedule)}>
                      <Badge variant={schedule.active ? "success" : "outline"}>
                        {schedule.active ? "Ativo" : "Pausado"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${schedule.name}`}
                      onClick={() => remove(schedule)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
