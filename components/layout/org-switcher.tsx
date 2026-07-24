"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

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
import { fakeCurrentOrganization, fakeOrganizations, type FakeOrganization } from "@/lib/mock-data";

export function OrgSwitcher() {
  const [current, setCurrent] = useState<FakeOrganization>(fakeCurrentOrganization);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="max-w-56 justify-between gap-2 px-2.5 font-normal">
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
          {fakeOrganizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setCurrent(org)}
              className="justify-between"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{org.name}</span>
                <span className="text-muted-foreground text-xs">Plano {org.plan}</span>
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
