/**
 * Verificação server-side do Cloudflare Turnstile. O widget no client
 * (components/public-form/captcha-placeholder.tsx) só resolve o desafio e
 * devolve um token opaco — a validação real, que não pode ser forjada pelo
 * client, é este `siteverify` contra o segredo.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TURNSTILE_SECRET_KEY não configurada.");
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) return false;

  const result = (await response.json()) as { success: boolean };
  return result.success === true;
}
