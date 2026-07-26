const PDFMONKEY_API_BASE = "https://api.pdfmonkey.io/api/v1";

type PdfMonkeyDocument = {
  id: string;
  status: "draft" | "pending" | "generating" | "success" | "failure";
  download_url: string | null;
  failure_cause: string | null;
};

/**
 * Gera o PDF do orçamento. A API do PDFMonkey é assíncrona (cria o
 * documento, gera em background), então este helper faz um polling curto —
 * o tempo até o primeiro orçamento é o KPI central do produto (CLAUDE.md),
 * então o teto de espera aqui é deliberadamente apertado.
 */
export async function generateQuotePdf(params: {
  templateId: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const apiKey = process.env.PDFMONKEY_API_KEY;
  if (!apiKey) {
    throw new Error("PDFMONKEY_API_KEY não configurada.");
  }

  const createResponse = await fetch(`${PDFMONKEY_API_BASE}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document: {
        document_template_id: params.templateId,
        payload: params.payload,
        status: "pending",
      },
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Falha ao criar documento no PDFMonkey (${createResponse.status}).`);
  }

  const created = (await createResponse.json()) as { document: PdfMonkeyDocument };
  const documentId = created.document.id;

  const maxAttempts = 10;
  const delayMs = 400;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const statusResponse = await fetch(`${PDFMONKEY_API_BASE}/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusResponse.ok) {
      throw new Error(`Falha ao consultar status do documento no PDFMonkey (${statusResponse.status}).`);
    }

    const current = (await statusResponse.json()) as { document: PdfMonkeyDocument };

    if (current.document.status === "success" && current.document.download_url) {
      return current.document.download_url;
    }
    if (current.document.status === "failure") {
      throw new Error(`Geração do PDF falhou no PDFMonkey: ${current.document.failure_cause ?? "motivo desconhecido"}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Tempo esgotado aguardando geração do PDF no PDFMonkey.");
}
