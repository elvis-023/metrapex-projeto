"use client";

import { FormField } from "@/components/auth/form-field";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepOrganizationProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

const segments = [
  "Distribuição",
  "Indústria",
  "Serviços",
  "Comércio varejista",
  "Construção civil",
];

export function StepOrganization({ state, dispatch }: StepOrganizationProps) {
  const { organization } = state;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Criar organização</h2>
        <p className="text-muted-foreground text-sm">
          Esses dados aparecem no orçamento e podem ser ajustados depois em Configurações.
        </p>
      </div>

      <FormField
        label="Nome da organização"
        name="organization-name"
        placeholder="Ex.: Metrapex Distribuidora"
        value={organization.name}
        onChange={(event) =>
          dispatch({ type: "SET_ORGANIZATION", field: "name", value: event.target.value })
        }
      />

      <FormField
        label="CNPJ ou CPF"
        name="organization-document"
        placeholder="00.000.000/0000-00"
        value={organization.document}
        onChange={(event) =>
          dispatch({ type: "SET_ORGANIZATION", field: "document", value: event.target.value })
        }
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="organization-segment" className="text-sm font-medium">
          Segmento (opcional)
        </label>
        <input
          id="organization-segment"
          name="organization-segment"
          list="onboarding-segments"
          placeholder="Ex.: Distribuição"
          value={organization.segment}
          onChange={(event) =>
            dispatch({ type: "SET_ORGANIZATION", field: "segment", value: event.target.value })
          }
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-3"
        />
        <datalist id="onboarding-segments">
          {segments.map((segment) => (
            <option key={segment} value={segment} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
