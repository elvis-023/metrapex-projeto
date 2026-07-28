import { timingSafeEqual } from "node:crypto";

/**
 * Autenticação de serviço para os endpoints que o n8n chama (Milestone 18) —
 * direção inversa do webhook de saída em `lib/integrations/n8n.ts`. Não há
 * sessão de usuário aqui, então não há organização para resolver: quem
 * autentica é o segredo compartilhado, e as rotas usam service_role
 * internamente (mesmo padrão do endpoint público, `app/api/public-quote/route.ts`).
 *
 * Comparação em tempo constante para não vazar, por timing, quantos bytes
 * do segredo o caller acertou.
 */
export function verifyAutomationSecret(request: Request): boolean {
  const expected = process.env.AUTOMATIONS_API_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
