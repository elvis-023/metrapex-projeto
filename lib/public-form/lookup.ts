import type { PublicFormAddress } from "@/lib/public-form/types";

/** Consulta real via BrasilAPI (proxied por app/api/public-quote/lookup-cnpj). */
export async function lookupCnpj(
  cnpjDigits: string,
): Promise<{ legalName: string; address: PublicFormAddress }> {
  const response = await fetch(`/api/public-quote/lookup-cnpj?cnpj=${cnpjDigits}`);
  if (!response.ok) {
    throw new Error("CNPJ não encontrado.");
  }
  return response.json();
}

/** Consulta real via ViaCEP (proxied por app/api/public-quote/lookup-cep). */
export async function lookupCep(cepDigits: string): Promise<PublicFormAddress> {
  const response = await fetch(`/api/public-quote/lookup-cep?cep=${cepDigits}`);
  if (!response.ok) {
    throw new Error("CEP não encontrado.");
  }
  return response.json();
}
