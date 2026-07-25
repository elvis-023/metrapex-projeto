"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signupAction } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Comece a gerar orçamentos automáticos em minutos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <FormField
            label="Nome"
            name="name"
            autoComplete="name"
            error={state?.fieldErrors?.name}
          />
          <FormField
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            error={state?.fieldErrors?.email}
          />
          <FormField
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            error={state?.fieldErrors?.password}
          />
          <FormField
            label="Confirmar senha"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={state?.fieldErrors?.confirmPassword}
          />
          {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
