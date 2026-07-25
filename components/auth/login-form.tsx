"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loginAction } from "@/lib/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse o painel da sua organização.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <FormField
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            error={state?.fieldErrors?.email}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <Link
                href="/forgot-password"
                className="text-primary text-xs font-medium hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(state?.fieldErrors?.password)}
              aria-describedby={state?.fieldErrors?.password ? "password-error" : undefined}
              className={cn(state?.fieldErrors?.password && "border-destructive")}
            />
            {state?.fieldErrors?.password ? (
              <p id="password-error" className="text-destructive text-sm">
                {state.fieldErrors.password}
              </p>
            ) : null}
          </div>
          {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Não tem uma conta?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
