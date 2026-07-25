"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  info?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    return {
      error:
        error.message === "User already registered"
          ? "Este e-mail já tem conta."
          : "Não foi possível criar a conta.",
    };
  }

  if (!data.session) {
    return {
      success: true,
      info: "Enviamos um e-mail de confirmação. Confirme para poder entrar.",
    };
  }

  redirect("/onboarding");
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

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  // Sempre "sucesso" para o usuário, exista ou não a conta — não vazar quais e-mails têm cadastro.
  return { success: true };
}

export async function resetPasswordAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const code = readString(formData, "code");
  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirmPassword");

  if (!code) {
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

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return { error: "Link de redefinição inválido ou expirado." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Não foi possível redefinir a senha." };
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

  if (!token || !email) {
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

  const supabase = await createClient();

  // O e-mail vem travado do convite (campo hidden), nunca do que o usuário digitaria —
  // accept_invite() confere de novo no banco, contra o e-mail gravado no convite.
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (signUpError && signUpError.message !== "User already registered") {
    return { error: "Não foi possível criar sua conta." };
  }

  if (signUpError) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return {
        error:
          "Já existe conta com este e-mail — entre com a senha existente para aceitar o convite.",
      };
    }
  }

  const { error: acceptError } = await supabase.rpc("accept_invite", { invite_token: token });
  if (acceptError) {
    return { error: acceptError.message || "Convite inválido ou expirado." };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
