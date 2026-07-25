"use client";

import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInviteAction } from "@/lib/auth/actions";
import type { OrgRole } from "@/lib/supabase/types";

export type InvitePreview = {
  token: string;
  email: string;
  role: OrgRole;
  organizationName: string;
  invitedBy: string;
};

export function InviteForm({ invite }: { invite: InvitePreview }) {
  const [state, formAction, isPending] = useActionState(acceptInviteAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aceitar convite</CardTitle>
        <CardDescription>
          {invite.invitedBy} convidou você para colaborar em{" "}
          <span className="text-foreground font-medium">{invite.organizationName}</span> como{" "}
          {invite.role === "admin" ? "admin" : "vendedor"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="token" value={invite.token} />
          <input type="hidden" name="email" value={invite.email} />
          <FormField label="E-mail" name="email-display" value={invite.email} disabled readOnly />
          <FormField
            label="Nome"
            name="name"
            autoComplete="name"
            error={state?.fieldErrors?.name}
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
            {isPending ? "Entrando..." : "Aceitar e entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
