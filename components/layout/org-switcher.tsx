"use client";

import { useState, useTransition } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionOrganization } from "@/lib/auth/session";
import { switchOrganizationAction } from "@/lib/organizations/actions";

const planLabels: Record<string, string> = {
  entrada: "Entrada",
  profissional: "Profissional",
  escala: "Escala",
};

export function OrgSwitcher({
  organizations,
  currentOrganization,
}: {
  organizations: SessionOrganization[];
  currentOrganization: SessionOrganization;
}) {
  const [current, setCurrent] = useState(currentOrganization);
  const [isPending, startTransition] = useTransition();

  function handleSelect(org: SessionOrganization) {
    if (org.id === current.id) return;
    setCurrent(org);
    startTransition(async () => {
      try {
        await switchOrganizationAction(org.id);
      } catch {
        setCurrent(currentOrganization);
        toast.error("Não foi possível trocar de organização.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            disabled={isPending}
            className="max-w-56 justify-between gap-2 px-2.5 font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{current.name}</span>
            </span>
            <ChevronsUpDown
              className="text-muted-foreground size-3.5 shrink-0"
              aria-hidden="true"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Trocar de organização</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelect(org)}
              className="justify-between"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{org.name}</span>
                <span className="text-muted-foreground text-xs">
                  Plano {planLabels[org.plan] ?? org.plan}
                </span>
              </span>
              {org.id === current.id && (
                <Check className="text-primary size-4 shrink-0" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
