"use client";

import { useRef } from "react";
import { Trash2Icon, UploadIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { sampleUploadRows } from "@/lib/onboarding/mock-data";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepCatalogProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

export function StepCatalog({ state, dispatch }: StepCatalogProps) {
  const { catalog } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorCount = catalog.rows.filter((row) => row.status === "erro").length;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    dispatch({ type: "UPLOAD_CATALOG_FILE", fileName: file.name, rows: sampleUploadRows });
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Popular catálogo</h2>
        <p className="text-muted-foreground text-sm">
          Importe uma planilha ou cadastre alguns produtos manualmente para começar.
        </p>
      </div>

      <div className="flex gap-1.5">
        <Button
          type="button"
          variant={catalog.mode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => dispatch({ type: "SET_CATALOG_MODE", mode: "upload" })}
        >
          Importar planilha
        </Button>
        <Button
          type="button"
          variant={catalog.mode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => dispatch({ type: "SET_CATALOG_MODE", mode: "manual" })}
        >
          Cadastro manual
        </Button>
      </div>

      {catalog.mode === "upload" ? (
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
              {catalog.fileName ? (
                <>
                  Arquivo: <span className="font-medium">{catalog.fileName}</span>
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
            Aceita .csv e .xlsx — código externo, nome, preço e categoria por linha.
          </p>
        </div>
      ) : (
        <div className="border-border flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-name" className="text-sm font-medium">
                Nome do produto
              </label>
              <input
                id="manual-name"
                value={catalog.manualProductName}
                onChange={(event) =>
                  dispatch({
                    type: "SET_MANUAL_PRODUCT",
                    field: "manualProductName",
                    value: event.target.value,
                  })
                }
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-3"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-price" className="text-sm font-medium">
                Preço
              </label>
              <input
                id="manual-price"
                placeholder="R$ 0,00"
                value={catalog.manualProductPrice}
                onChange={(event) =>
                  dispatch({
                    type: "SET_MANUAL_PRODUCT",
                    field: "manualProductPrice",
                    value: event.target.value,
                  })
                }
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-28 rounded-lg border bg-transparent px-2.5 py-1 text-sm tabular-nums outline-none focus-visible:ring-3"
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!catalog.manualProductName.trim() || !catalog.manualProductPrice.trim()}
              onClick={() => dispatch({ type: "ADD_MANUAL_PRODUCT" })}
            >
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {catalog.rows.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pré-visualização ({catalog.rows.length} linhas)</p>
            {errorCount > 0 ? (
              <Badge variant="danger">{errorCount} com erro</Badge>
            ) : (
              <Badge variant="success">Tudo certo</Badge>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.rows.map((row) => (
                <TableRow key={row.row}>
                  <TableCell className="font-medium">{row.code || "—"}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="tabular-nums">{row.price}</TableCell>
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
                      onClick={() => dispatch({ type: "REMOVE_CATALOG_ROW", row: row.row })}
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
              {catalog.rows
                .filter((row) => row.status === "erro")
                .map((row) => (
                  <li key={row.row}>
                    Linha {row.row}: {row.error}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="Nenhum produto ainda"
          description="Importe uma planilha ou cadastre manualmente — você pode continuar sem catálogo e voltar depois."
        />
      )}
    </div>
  );
}
