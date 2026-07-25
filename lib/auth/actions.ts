"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MOCK_SESSION_COOKIE } from "@/lib/auth/session";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function setSessionCookie(email: string) {
  const jar = await cookies();
  jar.set(MOCK_SESSION_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function loginAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const next = readString(formData, "next");

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Informe o e-mail.";
  else if (!EMAIL_REGEX.test(email)) fieldErrors.email = "E-mail inválido.";
  if (!password) fieldErrors.password = "Informe a senha.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  await setSessionCookie(email);
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signupAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const name = readString(formData, "name");
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirmPassword");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Informe seu nome.";
  if (!email) fieldErrors.email = "Informe o e-mail.";
  else if (!EMAIL_REGEX.test(email)) fieldErrors.email = "E-mail inválido.";
  if (!password) fieldErrors.password = "Informe uma senha.";
  else if (password.length < 8) fieldErrors.password = "A senha precisa ter ao menos 8 caracteres.";
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirme a senha.";
  else if (password && confirmPassword !== password)
    fieldErrors.confirmPassword = "As senhas não coincidem.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  await setSessionCookie(email);
  redirect("/dashboard");
}

export async function forgotPasswordAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const email = readString(formData, "email");

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Informe o e-mail.";
  else if (!EMAIL_REGEX.test(email)) fieldErrors.email = "E-mail inválido.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return { success: true };
}

export async function resetPasswordAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const token = readString(formData, "token");
  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirmPassword");

  if (!token) {
    return { error: "Link de redefinição inválido ou expirado." };
  }

  const fieldErrors: Record<string, string> = {};
  if (!password) fieldErrors.password = "Informe uma senha.";
  else if (password.length < 8) fieldErrors.password = "A senha precisa ter ao menos 8 caracteres.";
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirme a senha.";
  else if (password && confirmPassword !== password)
    fieldErrors.confirmPassword = "As senhas não coincidem.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return { success: true };
}

export async function acceptInviteAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const token = readString(formData, "token");
  const name = readString(formData, "name");
  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirmPassword");
  const email = readString(formData, "email");

  if (!token) {
    return { error: "Convite inválido ou expirado." };
  }

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Informe seu nome.";
  if (!password) fieldErrors.password = "Informe uma senha.";
  else if (password.length < 8) fieldErrors.password = "A senha precisa ter ao menos 8 caracteres.";
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirme a senha.";
  else if (password && confirmPassword !== password)
    fieldErrors.confirmPassword = "As senhas não coincidem.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  await setSessionCookie(email || `convidado+${token}@metrapex.com.br`);
  redirect("/dashboard");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(MOCK_SESSION_COOKIE);
  redirect("/login");
}
