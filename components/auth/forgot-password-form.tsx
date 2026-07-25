"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPasswordAction } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, undefined);

  if (state?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Se esse e-mail estiver cadastrado, enviamos um link de redefinição de senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-primary text-sm font-medium hover:underline">
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Informe seu e-mail para receber o link de redefinição.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <FormField
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            error={state?.fieldErrors?.email}
          />
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Enviando..." : "Enviar link de redefinição"}
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Lembrou a senha?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
