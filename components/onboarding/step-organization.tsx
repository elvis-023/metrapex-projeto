"use client";

import { useCallback, useEffect, useRef } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { formatCep, formatDocument, onlyDigits } from "@/lib/public-form/mock-data";
import { detectDocumentType, isValidCnpj } from "@/lib/public-form/cpf-cnpj";
import { lookupCep, lookupCnpj } from "@/lib/public-form/lookup";
import type { OnboardingAction } from "@/lib/onboarding/reducer";
import type { OnboardingState } from "@/lib/onboarding/types";

type StepOrganizationProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
};

/** Espera o cliente parar de digitar — mesmo desenho de components/public-form/step-document.tsx. */
const LOOKUP_DEBOUNCE_MS = 500;

export function StepOrganization({ state, dispatch }: StepOrganizationProps) {
  const { organization } = state;
  const documentType = detectDocumentType(organization.document);

  /**
   * Reaproveita o client de consulta do formulário público
   * (lib/public-form/lookup.ts, proxy de app/api/public-quote/lookup-cnpj) —
   * mesmo contrato, mesma chamada à BrasilAPI, sem duplicar a lógica aqui.
   */
  const requestedDocumentRef = useRef<string | null>(null);

  const runDocumentLookup = useCallback(
    async (digits: string) => {
      requestedDocumentRef.current = digits;
      dispatch({ type: "LOOKUP_ORGANIZATION_DOCUMENT_START" });
      try {
        const result = await lookupCnpj(digits);
        if (requestedDocumentRef.current !== digits) return;
        dispatch({
          type: "LOOKUP_ORGANIZATION_DOCUMENT_SUCCESS",
          legalName: result.legalName,
          address: result.address,
        });
      } catch {
        if (requestedDocumentRef.current !== digits) return;
        requestedDocumentRef.current = null;
        dispatch({ type: "LOOKUP_ORGANIZATION_DOCUMENT_ERROR" });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!isValidCnpj(organization.document)) return;
    if (requestedDocumentRef.current === organization.document) return;

    const digits = organization.document;
    const timer = setTimeout(() => runDocumentLookup(digits), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [organization.document, runDocumentLookup]);

  const requestedCepRef = useRef<string | null>(null);

  const runCepLookup = useCallback(
    async (digits: string) => {
      requestedCepRef.current = digits;
      dispatch({ type: "LOOKUP_ORGANIZATION_CEP_START" });
      try {
        const address = await lookupCep(digits);
        if (requestedCepRef.current !== digits) return;
        dispatch({ type: "LOOKUP_ORGANIZATION_CEP_SUCCESS", address });
      } catch {
        if (requestedCepRef.current !== digits) return;
        requestedCepRef.current = null;
        dispatch({ type: "LOOKUP_ORGANIZATION_CEP_ERROR" });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    // Com CNPJ o endereço já vem da BrasilAPI — mesma guarda de
    // components/public-form/step-document.tsx.
    if (documentType === "cnpj") return;
    if (organization.address.zip.length !== 8) return;
    if (requestedCepRef.current === organization.address.zip) return;

    const digits = organization.address.zip;
    const timer = setTimeout(() => runCepLookup(digits), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [organization.address.zip, documentType, runCepLookup]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Criar organização</h2>
        <p className="text-muted-foreground text-sm">
          Esses dados aparecem no orçamento e podem ser ajustados depois em Configurações.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <FormField
          label="CNPJ ou CPF"
          name="organization-document"
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
          value={formatDocument(organization.document)}
          onChange={(event) =>
            dispatch({
              type: "SET_ORGANIZATION_DOCUMENT",
              digits: onlyDigits(event.target.value).slice(0, 14),
            })
          }
        />

        {/* Preenchimento sem ação do usuário — precisa ser anunciado pro leitor de tela. */}
        <div aria-live="polite">
          {organization.documentLookupStatus === "loading" ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
              Consultando o CNPJ e preenchendo os dados…
            </p>
          ) : null}

          {organization.documentLookupStatus === "done" ? (
            <p className="text-muted-foreground text-xs">
              Dados preenchidos automaticamente. Confira e ajuste se precisar.
            </p>
          ) : null}

          {organization.documentLookupStatus === "error" ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-destructive text-sm">
                Não encontramos esse CNPJ. Confira os números ou preencha os dados manualmente
                abaixo.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runDocumentLookup(organization.document)}
              >
                <SearchIcon />
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <FormField
        label="Nome da organização"
        name="organization-name"
        placeholder="Ex.: Trezofy Distribuidora"
        value={organization.name}
        onChange={(event) => dispatch({ type: "SET_ORGANIZATION_NAME", value: event.target.value })}
      />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Endereço</p>

        {documentType !== "cnpj" ? (
          <div className="flex flex-col gap-1.5">
            <FormField
              label="CEP"
              name="organization-zip"
              inputMode="numeric"
              placeholder="00000-000"
              value={formatCep(organization.address.zip)}
              onChange={(event) =>
                dispatch({
                  type: "SET_ORGANIZATION_ADDRESS_FIELD",
                  field: "zip",
                  value: onlyDigits(event.target.value).slice(0, 8),
                })
              }
            />

            <div aria-live="polite">
              {state.organization.cepLookupStatus === "loading" ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
                  Buscando o endereço do CEP…
                </p>
              ) : null}

              {state.organization.cepLookupStatus === "done" ? (
                <p className="text-muted-foreground text-xs">
                  Endereço preenchido automaticamente. Falta só o número.
                </p>
              ) : null}

              {state.organization.cepLookupStatus === "error" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-destructive text-sm">
                    Não encontramos esse CEP. Confira o número ou preencha o endereço manualmente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => runCepLookup(organization.address.zip)}
                  >
                    <SearchIcon />
                    Tentar novamente
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FormField
              label="Rua"
              name="organization-street"
              value={organization.address.street}
              onChange={(event) =>
                dispatch({
                  type: "SET_ORGANIZATION_ADDRESS_FIELD",
                  field: "street",
                  value: event.target.value,
                })
              }
            />
          </div>
          <FormField
            label="Número"
            name="organization-number"
            value={organization.address.number}
            onChange={(event) =>
              dispatch({
                type: "SET_ORGANIZATION_ADDRESS_FIELD",
                field: "number",
                value: event.target.value,
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Complemento (opcional)"
            name="organization-complement"
            value={organization.address.complement}
            onChange={(event) =>
              dispatch({
                type: "SET_ORGANIZATION_ADDRESS_FIELD",
                field: "complement",
                value: event.target.value,
              })
            }
          />
          <FormField
            label="Bairro"
            name="organization-neighborhood"
            value={organization.address.neighborhood}
            onChange={(event) =>
              dispatch({
                type: "SET_ORGANIZATION_ADDRESS_FIELD",
                field: "neighborhood",
                value: event.target.value,
              })
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FormField
              label="Cidade"
              name="organization-city"
              value={organization.address.city}
              onChange={(event) =>
                dispatch({
                  type: "SET_ORGANIZATION_ADDRESS_FIELD",
                  field: "city",
                  value: event.target.value,
                })
              }
            />
          </div>
          <FormField
            label="UF"
            name="organization-state"
            maxLength={2}
            value={organization.address.state}
            onChange={(event) =>
              dispatch({
                type: "SET_ORGANIZATION_ADDRESS_FIELD",
                field: "state",
                value: event.target.value.toUpperCase(),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
