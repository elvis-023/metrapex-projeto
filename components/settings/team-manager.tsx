"use client";

import { useState } from "react";
import { MailIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TeamInvite, TeamMember, TeamRole } from "@/lib/settings/types";

const roleLabels: Record<TeamRole, string> = { admin: "Admin", vendedor: "Vendedor" };

const inviteDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function TeamManager({
  initialMembers,
  initialInvites,
}: {
  initialMembers: TeamMember[];
  initialInvites: TeamInvite[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("vendedor");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const adminCount = members.filter((m) => m.role === "admin").length;

  function changeRole(member: TeamMember, role: TeamRole) {
    if (member.role === "admin" && role === "vendedor" && adminCount <= 1) {
      toast.error("A organização precisa de ao menos um admin.");
      return;
    }
    setMembers((current) => current.map((m) => (m.id === member.id ? { ...m, role } : m)));
    toast.success(`Papel de ${member.name} atualizado para ${roleLabels[role]}.`);
  }

  function removeMember(member: TeamMember) {
    if (member.isCurrentUser) {
      toast.error("Você não pode remover a si mesmo.");
      return;
    }
    if (member.role === "admin" && adminCount <= 1) {
      toast.error("A organização precisa de ao menos um admin.");
      return;
    }
    setMembers((current) => current.filter((m) => m.id !== member.id));
    toast.success(`${member.name} removido da organização.`);
  }

  function openInviteDialog() {
    setInviteEmail("");
    setInviteRole("vendedor");
    setInviteError(null);
    setInviteOpen(true);
  }

  function handleSendInvite() {
    const trimmed = inviteEmail.trim();
    if (!isValidEmail(trimmed)) {
      setInviteError("E-mail inválido.");
      return;
    }
    const alreadyMember = members.some((m) => m.email.toLowerCase() === trimmed.toLowerCase());
    const alreadyInvited = invites.some((i) => i.email.toLowerCase() === trimmed.toLowerCase());
    if (alreadyMember || alreadyInvited) {
      setInviteError("Já existe um colaborador ou convite pendente com esse e-mail.");
      return;
    }

    setInvites((current) => [
      ...current,
      {
        id: `invite_${crypto.randomUUID()}`,
        email: trimmed,
        role: inviteRole,
        invitedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    toast.success(`Convite enviado para ${trimmed}.`);
    setInviteOpen(false);
  }

  function changeInviteRole(invite: TeamInvite, role: TeamRole) {
    setInvites((current) => current.map((i) => (i.id === invite.id ? { ...i, role } : i)));
    toast.success(`Convite de ${invite.email} atualizado para ${roleLabels[role]}.`);
  }

  function cancelInvite(invite: TeamInvite) {
    setInvites((current) => current.filter((i) => i.id !== invite.id));
    toast.success("Convite cancelado.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Colaboradores</CardTitle>
            <CardDescription>
              Admin tem acesso total e configura tudo; vendedor opera orçamentos, clientes e
              pipeline.
            </CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger render={<Button size="sm" onClick={openInviteDialog} />}>
              <PlusIcon />
              Convidar colaborador
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar colaborador</DialogTitle>
                <DialogDescription>
                  Enviamos um e-mail com um link para aceitar o convite e criar a senha.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="invite-email" className="text-sm font-medium">
                    E-mail
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    aria-invalid={Boolean(inviteError)}
                    className={cn(inviteError && "border-destructive")}
                  />
                  {inviteError ? <p className="text-destructive text-sm">{inviteError}</p> : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="invite-role" className="text-sm font-medium">
                    Papel
                  </label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => value && setInviteRole(value as TeamRole)}
                  >
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue>{(value: string) => roleLabels[value as TeamRole]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSendInvite}>Enviar convite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate font-medium">
                          {member.name}
                          {member.isCurrentUser ? <Badge variant="outline">Você</Badge> : null}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(value) => value && changeRole(member, value as TeamRole)}
                    >
                      <SelectTrigger size="sm" aria-label={`Papel de ${member.name}`}>
                        <SelectValue>
                          {(value: string) => roleLabels[value as TeamRole]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${member.name}`}
                      onClick={() => removeMember(member)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
            <CardDescription>
              Ainda não aceitos — o colaborador não tem acesso até aceitar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      <MailIcon className="text-muted-foreground size-4" aria-hidden="true" />
                      {invite.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={invite.role}
                        onValueChange={(value) =>
                          value && changeInviteRole(invite, value as TeamRole)
                        }
                      >
                        <SelectTrigger size="sm" aria-label={`Papel do convite de ${invite.email}`}>
                          <SelectValue>
                            {(value: string) => roleLabels[value as TeamRole]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {inviteDateFormatter.format(new Date(`${invite.invitedAt}T00:00:00`))}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Cancelar convite de ${invite.email}`}
                        onClick={() => cancelInvite(invite)}
                      >
                        <XIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
