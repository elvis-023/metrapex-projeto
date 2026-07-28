"use client";

import { useState, type RefObject } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRawDataAction } from "@/lib/reports/actions";
import type { CustomReportFilters, ExportRawObject } from "@/lib/reports/types";

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * Exportação de dado bruto (CSV/Excel, via Server Action) e de imagem do
 * gráfico (PNG/PDF, client-side puro — sem template novo no PDFMonkey e sem
 * navegador headless de servidor; captura o DOM já renderizado com
 * `html-to-image` e, para PDF, embute o PNG resultante com `jspdf`).
 */
export function ExportButtons({
  chartRef,
  exportObject,
  filters,
  filenameHint,
}: {
  chartRef: RefObject<HTMLElement | null>;
  exportObject?: ExportRawObject;
  filters?: CustomReportFilters;
  filenameHint: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleRawExport(format: "csv" | "xlsx") {
    if (!exportObject || !filters) return;
    setIsExporting(true);
    try {
      const file = await exportRawDataAction(exportObject, filters, format);
      downloadDataUrl(file.filename, `data:${file.mimeType};base64,${file.base64}`);
    } catch {
      toast.error("Não foi possível exportar o dado bruto.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImageExport(kind: "png" | "pdf") {
    const node = chartRef.current;
    if (!node) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, { backgroundColor: "#ffffff", pixelRatio: 2 });

      if (kind === "png") {
        downloadDataUrl(`${filenameHint}.png`, dataUrl);
        return;
      }

      const { jsPDF } = await import("jspdf");
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Falha ao carregar a imagem capturada."));
        image.src = dataUrl;
      });
      const pdf = new jsPDF({
        orientation: image.width >= image.height ? "landscape" : "portrait",
        unit: "px",
        format: [image.width, image.height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, image.width, image.height);
      pdf.save(`${filenameHint}.pdf`);
    } catch {
      toast.error("Não foi possível exportar o gráfico.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={isExporting} />}>
        <DownloadIcon />
        Exportar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {exportObject && filters ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Dado bruto filtrado</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleRawExport("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRawExport("xlsx")}>Excel</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Gráfico</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleImageExport("png")}>Imagem (PNG)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleImageExport("pdf")}>PDF</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
