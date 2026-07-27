/**
 * Validação real de CPF/CNPJ (dígito verificador), não só formato. Achado na
 * revisão adversarial do Milestone 15: o endpoint público aceitava qualquer
 * sequência de 14 dígitos não repetidos como CNPJ — a rota de lookup
 * (BrasilAPI/ViaCEP) rejeitava documento inexistente, mas o submit em si
 * nunca checava o dígito verificador, então "11111111111111" virava
 * orçamento de verdade. Usado no client (feedback imediato) e no servidor
 * (route.ts — nunca confiar só na validação do client).
 */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isRepeatedDigits(digits: string): boolean {
  return digits.length > 0 && digits.split("").every((digit) => digit === digits[0]);
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = digits
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

const CPF_WEIGHTS_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_WEIGHTS_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || isRepeatedDigits(digits)) return false;

  const base = digits.slice(0, 9);
  const d1 = checkDigit(base, CPF_WEIGHTS_1);
  const d2 = checkDigit(base + d1, CPF_WEIGHTS_2);
  return digits === `${base}${d1}${d2}`;
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || isRepeatedDigits(digits)) return false;

  const base = digits.slice(0, 12);
  const d1 = checkDigit(base, CNPJ_WEIGHTS_1);
  const d2 = checkDigit(base + d1, CNPJ_WEIGHTS_2);
  return digits === `${base}${d1}${d2}`;
}

export function isValidDocument(type: "cpf" | "cnpj", value: string): boolean {
  return type === "cpf" ? isValidCpf(value) : isValidCnpj(value);
}

/**
 * Descobre se o documento digitado é CPF ou CNPJ pela quantidade de dígitos —
 * o formulário público não tem mais seletor manual. `null` = ainda
 * indeterminado (o cliente não terminou de digitar, ou 12/13 dígitos, que não
 * é nem um nem outro).
 *
 * O tipo é sempre DERIVADO do documento, nunca guardado no estado: com as
 * duas coisas no estado, um "escolhi CNPJ mas digitei CPF" viraria estado
 * inconsistente e o backend receberia um `documentType` que não bate com o
 * documento.
 */
export function detectDocumentType(value: string): "cpf" | "cnpj" | null {
  const digits = onlyDigits(value);
  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";
  return null;
}

/**
 * Gera um CNPJ com dígito verificador correto a partir de um prefixo de 12
 * dígitos — para scripts de verificação (scripts/verify-public-quote.mts,
 * scripts/attack-public-quote.mts) montarem documentos de teste válidos sem
 * precisar calcular o dígito na mão. Não tem uso em código de produto.
 */
export function buildTestCnpj(base12: string): string {
  const base = onlyDigits(base12).padStart(12, "0").slice(0, 12);
  const d1 = checkDigit(base, CNPJ_WEIGHTS_1);
  const d2 = checkDigit(base + d1, CNPJ_WEIGHTS_2);
  return `${base}${d1}${d2}`;
}
