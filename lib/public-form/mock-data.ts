import type { PublicFormAddress, PublicOrganization } from "@/lib/public-form/types";

export const fakeOrganization: PublicOrganization = {
  slug: "metrapex-demo",
  name: "Metrapex Distribuidora",
  logoInitial: "M",
  supportEmail: "contato@metrapexdistribuidora.com.br",
};

/** UI mockada — a resolução real por chave pública do snippet entra no Milestone 15. */
export async function getPublicOrganization(slug: string): Promise<PublicOrganization> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { ...fakeOrganization, slug };
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Sequências como "00000000000" ou "11111111111111" passam na checagem de
 * tamanho mas nunca são CPF/CNPJ real — é o caso clássico de "documento
 * inválido" que dá pra simular sem implementar o dígito verificador completo.
 */
export function isRepeatedDigits(digits: string): boolean {
  return digits.length > 0 && digits.split("").every((digit) => digit === digits[0]);
}

export function isValidCpfFormat(digits: string): boolean {
  return digits.length === 11 && !isRepeatedDigits(digits);
}

export function formatCpf(digits: string): string {
  return digits
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCnpj(digits: string): string {
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatCep(digits: string): string {
  return digits.slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export function formatPhone(digits: string): string {
  const trimmed = digits.slice(0, 11);
  if (trimmed.length <= 10) {
    return trimmed.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return trimmed.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

const mockAddressPool: PublicFormAddress[] = [
  {
    zip: "",
    street: "Av. Paulista",
    number: "",
    complement: "",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
  },
  {
    zip: "",
    street: "Rua das Flores",
    number: "",
    complement: "",
    neighborhood: "Centro",
    city: "Curitiba",
    state: "PR",
  },
  {
    zip: "",
    street: "Rua da Bahia",
    number: "",
    complement: "",
    neighborhood: "Lourdes",
    city: "Belo Horizonte",
    state: "MG",
  },
];

function pickMockAddress(seed: string): PublicFormAddress {
  const index = onlyDigits(seed)
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
  return mockAddressPool[index % mockAddressPool.length];
}

const mockCompanyPrefixes = [
  "Comercial",
  "Distribuidora",
  "Indústria e Comércio",
  "Serviços",
  "Atacadista",
];

function pickMockCompanyName(cnpjDigits: string): string {
  const index = cnpjDigits.split("").reduce((sum, digit) => sum + Number(digit), 0);
  const prefix = mockCompanyPrefixes[index % mockCompanyPrefixes.length];
  return `${prefix} ${cnpjDigits.slice(0, 4)} Ltda.`;
}

/** Mock do fluxo BrasilAPI (consulta por CNPJ) — retorna razão social e endereço. */
export async function lookupCnpj(
  cnpjDigits: string,
): Promise<{ legalName: string; address: PublicFormAddress }> {
  await new Promise((resolve) => setTimeout(resolve, 900));

  if (cnpjDigits.length !== 14) {
    throw new Error("CNPJ deve ter 14 dígitos.");
  }
  if (isRepeatedDigits(cnpjDigits)) {
    throw new Error("CNPJ inválido.");
  }

  const address = pickMockAddress(cnpjDigits);
  return {
    legalName: pickMockCompanyName(cnpjDigits),
    address: { ...address, zip: formatCep(cnpjDigits.slice(0, 8)) },
  };
}

/** Mock do fluxo ViaCEP (consulta por CEP, usada quando o documento é CPF). */
export async function lookupCep(cepDigits: string): Promise<PublicFormAddress> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  if (cepDigits.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos.");
  }
  if (isRepeatedDigits(cepDigits)) {
    throw new Error("CEP inválido.");
  }

  const address = pickMockAddress(cepDigits);
  return { ...address, zip: formatCep(cepDigits) };
}

export function generateProtocolNumber(): string {
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `ORC-${random}`;
}
