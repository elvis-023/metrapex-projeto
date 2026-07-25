"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { cn } from "@/lib/utils";
import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatPhone,
  isValidCpfFormat,
  lookupCep,
  lookupCnpj,
  onlyDigits,
} from "@/lib/public-form/mock-data";
import type { PublicFormAction } from "@/lib/public-form/reducer";
import type { DocumentType, PublicFormState } from "@/lib/public-form/types";

export function StepDocument({
  state,
  dispatch,
}: {
  state: PublicFormState;
  dispatch: (action: PublicFormAction) => void;
}) {
  async function handleDocumentLookup() {
    dispatch({ type: "LOOKUP_DOCUMENT_START" });
    try {
      const result = await lookupCnpj(state.document);
      dispatch({
        type: "LOOKUP_DOCUMENT_SUCCESS",
        legalName: result.legalName,
        address: result.address,
      });
    } catch {
      dispatch({ type: "LOOKUP_DOCUMENT_ERROR" });
    }
  }

  async function handleCepLookup() {
    dispatch({ type: "LOOKUP_CEP_START" });
    try {
      const address = await lookupCep(state.address.zip);
      dispatch({ type: "LOOKUP_CEP_SUCCESS", address });
    } catch {
      dispatch({ type: "LOOKUP_CEP_ERROR" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Quem está pedindo o orçamento?</h2>
        <p className="text-muted-foreground text-sm">
          Usamos seu CPF ou CNPJ só para identificar o pedido e preencher o endereço mais rápido.
        </p>
      </div>

      <div className="border-input inline-flex w-fit overflow-hidden rounded-lg border">
        {(["cnpj", "cpf"] as DocumentType[]).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={state.documentType === type}
            onClick={() => dispatch({ type: "SET_DOCUMENT_TYPE", documentType: type })}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              type === "cpf" && "border-input border-l",
              state.documentType === type ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      {state.documentType === "cnpj" ? (
        <>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FormField
                label="CNPJ"
                name="document-cnpj"
                placeholder="00.000.000/0000-00"
                value={formatCnpj(state.document)}
                onChange={(event) =>
                  dispatch({
                    type: "SET_DOCUMENT",
                    digits: onlyDigits(event.target.value).slice(0, 14),
                  })
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={state.document.length !== 14 || state.documentLookupStatus === "loading"}
              onClick={handleDocumentLookup}
            >
              {state.documentLookupStatus === "loading" ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SearchIcon />
              )}
              Consultar
            </Button>
          </div>

          {state.documentLookupStatus === "error" ? (
            <p className="text-destructive text-sm">
              Não encontramos esse CNPJ. Confira os números ou preencha os dados manualmente abaixo.
            </p>
          ) : null}

          <FormField
            label="Razão social"
            name="legal-name"
            placeholder="Preenchido automaticamente após consultar o CNPJ"
            value={state.legalName}
            onChange={(event) =>
              dispatch({ type: "SET_FIELD", field: "legalName", value: event.target.value })
            }
          />

          <FormField
            label="Nome do responsável"
            name="contact-name"
            placeholder="Quem está solicitando o orçamento"
            value={state.contactName}
            onChange={(event) =>
              dispatch({ type: "SET_FIELD", field: "contactName", value: event.target.value })
            }
          />
        </>
      ) : (
        <>
          <FormField
            label="Nome completo"
            name="legal-name"
            placeholder="Seu nome completo"
            value={state.legalName}
            onChange={(event) =>
              dispatch({ type: "SET_FIELD", field: "legalName", value: event.target.value })
            }
          />

          <FormField
            label="CPF"
            name="document-cpf"
            placeholder="000.000.000-00"
            value={formatCpf(state.document)}
            error={
              state.document.length === 11 && !isValidCpfFormat(state.document)
                ? "CPF inválido."
                : undefined
            }
            onChange={(event) =>
              dispatch({
                type: "SET_DOCUMENT",
                digits: onlyDigits(event.target.value).slice(0, 11),
              })
            }
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="E-mail"
          name="email"
          type="email"
          placeholder="voce@exemplo.com"
          value={state.email}
          onChange={(event) =>
            dispatch({ type: "SET_FIELD", field: "email", value: event.target.value })
          }
        />
        <FormField
          label="Telefone"
          name="phone"
          placeholder="(00) 00000-0000"
          value={formatPhone(onlyDigits(state.phone))}
          onChange={(event) =>
            dispatch({ type: "SET_FIELD", field: "phone", value: onlyDigits(event.target.value) })
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Endereço</p>

        {state.documentType === "cpf" ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FormField
                label="CEP"
                name="zip"
                placeholder="00000-000"
                value={formatCep(state.address.zip)}
                onChange={(event) =>
                  dispatch({ type: "SET_CEP", digits: onlyDigits(event.target.value).slice(0, 8) })
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={state.address.zip.length !== 8 || state.cepLookupStatus === "loading"}
              onClick={handleCepLookup}
            >
              {state.cepLookupStatus === "loading" ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SearchIcon />
              )}
              Buscar CEP
            </Button>
          </div>
        ) : null}

        {state.cepLookupStatus === "error" ? (
          <p className="text-destructive text-sm">
            Não encontramos esse CEP. Confira o número ou preencha o endereço manualmente.
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FormField
              label="Rua"
              name="street"
              value={state.address.street}
              onChange={(event) =>
                dispatch({ type: "SET_ADDRESS_FIELD", field: "street", value: event.target.value })
              }
            />
          </div>
          <FormField
            label="Número"
            name="number"
            value={state.address.number}
            onChange={(event) =>
              dispatch({ type: "SET_ADDRESS_FIELD", field: "number", value: event.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Complemento (opcional)"
            name="complement"
            value={state.address.complement}
            onChange={(event) =>
              dispatch({
                type: "SET_ADDRESS_FIELD",
                field: "complement",
                value: event.target.value,
              })
            }
          />
          <FormField
            label="Bairro"
            name="neighborhood"
            value={state.address.neighborhood}
            onChange={(event) =>
              dispatch({
                type: "SET_ADDRESS_FIELD",
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
              name="city"
              value={state.address.city}
              onChange={(event) =>
                dispatch({ type: "SET_ADDRESS_FIELD", field: "city", value: event.target.value })
              }
            />
          </div>
          <FormField
            label="UF"
            name="state"
            maxLength={2}
            value={state.address.state}
            onChange={(event) =>
              dispatch({
                type: "SET_ADDRESS_FIELD",
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
