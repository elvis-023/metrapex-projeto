import type { Metadata } from "next";
import Link from "next/link";

import { InviteForm } from "@/components/auth/invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFakeInvite } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Aceitar convite" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = getFakeInvite(token);

  if (!invite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Convite inválido</CardTitle>
          <CardDescription>
            Esse link de convite não existe mais ou já expirou. Peça para o administrador da
            organização enviar um novo convite.
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

  return <InviteForm invite={invite} />;
}
