export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
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

/**
 * Máscara do campo único de documento: até 11 dígitos formata como CPF, a
 * partir do 12º vira CNPJ. Em 11 dígitos é ambíguo (CPF completo ou CNPJ pela
 * metade) — formatar como CPF é a escolha certa porque é o caso completo.
 */
export function formatDocument(digits: string): string {
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
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
