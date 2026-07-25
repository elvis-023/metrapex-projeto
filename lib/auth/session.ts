/**
 * Mock de sessão (Milestone 3) — sem Supabase Auth ainda.
 * Cookie assinado nada, apenas presença + e-mail. Substituído no Milestone 11.
 */
export const MOCK_SESSION_COOKIE = "mock_session";

export const PROTECTED_PATHS = [
  "/dashboard",
  "/catalog",
  "/customers",
  "/pipeline",
  "/quotes",
  "/settings",
] as const;

export const AUTH_ONLY_PATHS = ["/login", "/signup"] as const;
