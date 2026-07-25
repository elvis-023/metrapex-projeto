"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordAction } from "@/lib/auth/actions";

export function ResetPasswordForm({ code }: { code: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, undefined);

  if (state?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Senha redefinida</CardTitle>
          <CardDescription>Sua senha foi atualizada. Você já pode entrar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            render={<Link href="/login">Ir para o login</Link>}
            nativeButton={false}
            className="w-full"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        {code ? (
          <form action={formAction} noValidate className="flex flex-col gap-4">
            <input type="hidden" name="code" value={code} />
            <FormField
              label="Nova senha"
              name="password"
              type="password"
              autoComplete="new-password"
              error={state?.fieldErrors?.password}
            />
            <FormField
              label="Confirmar nova senha"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              error={state?.fieldErrors?.confirmPassword}
            />
            {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Salvando..." : "Redefinir senha"}
            </Button>
          </form>
        ) : (
          <p className="text-destructive text-sm">
            Link de redefinição inválido ou expirado. Solicite um novo link.
          </p>
        )}
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-primary font-medium hover:underline">
            Solicitar novo link
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
