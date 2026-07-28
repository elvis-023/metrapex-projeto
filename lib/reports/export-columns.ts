import { currencyFormatter } from "@/lib/dashboard/format";
import { quantityFormatter } from "@/lib/reports/format";
import { csvToBase64, rowsToCsv, rowsToXlsxBase64, type ExportColumn } from "@/lib/reports/export";
import type { RawCustomerRow, RawQuoteItemRow, RawQuoteRow } from "@/lib/reports/raw";
import type { ExportFormat, ExportRawObject } from "@/lib/reports/types";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatMoney(value: number | null): string {
  return value === null ? "" : currencyFormatter.format(value);
}

export const quoteExportColumns: ExportColumn<RawQuoteRow>[] = [
  { header: "Número", value: (row) => row.number },
  { header: "Cliente", value: (row) => row.customerName },
  { header: "Vendedor", value: (row) => row.sellerName },
  { header: "Origem", value: (row) => row.sourceLabel },
  { header: "Etapa", value: (row) => row.status },
  { header: "Faixa de valor", value: (row) => row.bandLabel },
  { header: "Total", value: (row) => formatMoney(row.total) },
  { header: "Criado em", value: (row) => formatDateTime(row.createdAt) },
  { header: "Validade", value: (row) => (row.expiresAt ? formatDateTime(row.expiresAt) : "") },
];

export const quoteItemExportColumns: ExportColumn<RawQuoteItemRow>[] = [
  { header: "Orçamento", value: (row) => row.quoteNumber },
  { header: "Código do produto", value: (row) => row.productCode },
  { header: "Produto", value: (row) => row.productName },
  { header: "Categoria", value: (row) => row.categoryName },
  { header: "Quantidade", value: (row) => quantityFormatter.format(row.quantity) },
  { header: "Total da linha", value: (row) => formatMoney(row.lineTotal) },
];

export const customerExportColumns: ExportColumn<RawCustomerRow>[] = [
  { header: "Nome", value: (row) => row.name },
  { header: "Documento", value: (row) => row.document },
  { header: "E-mail", value: (row) => row.email },
  { header: "Telefone", value: (row) => row.phone },
  { header: "Cadastrado em", value: (row) => formatDateTime(row.createdAt) },
];

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Serializa o dado bruto de um objeto para CSV/Excel — usada tanto pela
 * exportação manual (`lib/reports/actions.ts`) quanto pelo anexo do envio
 * agendado (`app/api/automations/send-reports/route.ts`), para as duas
 * pontas nunca divergirem nas colunas exportadas.
 */
export function buildRawExportFile(
  object: ExportRawObject,
  rows: unknown[],
  format: ExportFormat,
): { base64: string; mimeType: string } {
  if (object === "quotes") {
    const typed = rows as RawQuoteRow[];
    return format === "csv"
      ? {
          base64: csvToBase64(rowsToCsv(typed, quoteExportColumns)),
          mimeType: "text/csv;charset=utf-8",
        }
      : { base64: rowsToXlsxBase64(typed, quoteExportColumns), mimeType: XLSX_MIME_TYPE };
  }
  if (object === "quote_items") {
    const typed = rows as RawQuoteItemRow[];
    return format === "csv"
      ? {
          base64: csvToBase64(rowsToCsv(typed, quoteItemExportColumns)),
          mimeType: "text/csv;charset=utf-8",
        }
      : { base64: rowsToXlsxBase64(typed, quoteItemExportColumns), mimeType: XLSX_MIME_TYPE };
  }
  const typed = rows as RawCustomerRow[];
  return format === "csv"
    ? {
        base64: csvToBase64(rowsToCsv(typed, customerExportColumns)),
        mimeType: "text/csv;charset=utf-8",
      }
    : { base64: rowsToXlsxBase64(typed, customerExportColumns), mimeType: XLSX_MIME_TYPE };
}
