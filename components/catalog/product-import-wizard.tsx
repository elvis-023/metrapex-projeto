"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ignoredEmptyRowCount, sampleImportRows } from "@/lib/catalog/mock-data";
import type { ProductImportRow } from "@/lib/catalog/types";

export function ProductImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductImportRow[]>([]);

  const errorCount = rows.filter((row) => row.status === "erro").length;
  const validCount = rows.length - errorCount;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRows(sampleImportRows);
    event.target.value = "";
  }

  function handleRemoveRow(row: number) {
    setRows((current) => current.filter((r) => r.row !== row));
  }

  function handleImport() {
    if (validCount === 0) return;
    toast.success(`${validCount} produto(s) importado(s).`);
    router.push("/catalog");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Importar planilha</h1>
        <p className="text-muted-foreground text-sm">
          Faz upsert por código externo — produtos existentes são atualizados, novos são criados.
        </p>
      </div>

      <div className="border-border flex flex-col gap-2 rounded-lg border border-dashed p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            {fileName ? (
              <>
                Arquivo: <span className="font-medium">{fileName}</span>
              </>
            ) : (
              "Nenhum arquivo selecionado."
            )}
          </p>
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon />
            Selecionar planilha
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Aceita .csv e .xlsx — código externo, nome, preço, estoque e categoria por linha.
        </p>
      </div>

      {rows.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pré-visualização ({rows.length} linhas)</CardTitle>
            <div className="flex items-center gap-1.5">
              {ignoredEmptyRowCount > 0 ? (
                <Badge variant="outline">{ignoredEmptyRowCount} linha(s) vazia(s) ignorada(s)</Badge>
              ) : null}
              {errorCount > 0 ? (
                <Badge variant="danger">{errorCount} com erro</Badge>
              ) : (
                <Badge variant="success">Tudo certo</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.row}>
                    <TableCell className="text-muted-foreground tabular-nums">{row.row}</TableCell>
                    <TableCell className="font-medium">{row.externalCode || "—"}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.price || "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.stock}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>
                      {row.status === "ok" ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="danger" className={cn("cursor-help")} title={row.error}>
                          Erro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remover linha"
                        onClick={() => handleRemoveRow(row.row)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {errorCount > 0 ? (
              <ul className="text-destructive flex flex-col gap-0.5 text-xs">
                {rows
                  .filter((row) => row.status === "erro")
                  .map((row) => (
                    <li key={row.row}>
                      Linha {row.row}: {row.error}
                    </li>
                  ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Nenhuma planilha selecionada"
          description="Selecione um arquivo .csv ou .xlsx para ver a pré-visualização e os erros de validação."
        />
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/catalog")}>
          Cancelar
        </Button>
        <Button type="button" disabled={validCount === 0} onClick={handleImport}>
          Importar {validCount > 0 ? `${validCount} produto(s)` : ""}
        </Button>
      </div>
    </div>
  );
}
