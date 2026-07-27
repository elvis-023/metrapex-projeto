"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { formatCep, formatDocument, formatPhone, onlyDigits } from "@/lib/public-form/mock-data";
import { detectDocumentType, isValidCnpj, isValidCpf } from "@/lib/public-form/cpf-cnpj";
import { lookupCep, lookupCnpj } from "@/lib/public-form/lookup";
import type { PublicFormAction } from "@/lib/public-form/reducer";
import type { PublicFormState } from "@/lib/public-form/types";

/**
 * Espera o cliente parar de digitar antes de consultar. O gatilho já é
 * restrito (só dispara com CNPJ completo e dígito verificador válido), mas o
 * debounce evita disparar no meio da correção de quem cola o número errado e
 * ajusta, e segura o consumo do rate limit da rota de lookup (30/10min por IP).
 */
const LOOKUP_DEBOUNCE_MS = 500;

export function StepDocument({
  state,
  dispatch,
}: {
  state: PublicFormState;
  dispatch: (action: PublicFormAction) => void;
}) {
  /** CPF ou CNPJ é deduzido do que foi digitado — não há seletor manual. */
  const documentType = detectDocumentType(state.document);

  /**
   * Num campo único, 11 dígitos tanto é um CPF completo quanto um CNPJ pela
   * metade. Mostrar "CPF inválido." enquanto o cliente ainda digita um CNPJ
   * seria um falso erro piscando na tela, então a validação do documento só
   * aparece quando ele sai do campo.
   */
  const [documentFocused, setDocumentFocused] = useState(false);

  const documentError =
    documentFocused || documentType === null
      ? undefined
      : documentType === "cpf" && !isValidCpf(state.document)
        ? "CPF inválido."
        : documentType === "cnpj" && !isValidCnpj(state.document)
          ? "CNPJ inválido."
          : undefined;

  /**
   * Guarda o CNPJ da última consulta disparada. Faz dois papéis: não repetir
   * a consulta do mesmo número, e descartar resposta obsoleta — se o cliente
   * corrigir o CNPJ enquanto a anterior ainda está no ar, a resposta antiga
   * não pode sobrescrever os dados da nova.
   */
  const requestedDocumentRef = useRef<string | null>(null);

  const runDocumentLookup = useCallback(
    async (digits: string) => {
      requestedDocumentRef.current = digits;
      dispatch({ type: "LOOKUP_DOCUMENT_START" });
      try {
        const result = await lookupCnpj(digits);
        if (requestedDocumentRef.current !== digits) return;
        dispatch({
          type: "LOOKUP_DOCUMENT_SUCCESS",
          legalName: result.legalName,
          address: result.address,
        });
      } catch {
        if (requestedDocumentRef.current !== digits) return;
        // Libera nova tentativa com o mesmo número (botão "Tentar novamente").
        requestedDocumentRef.current = null;
        dispatch({ type: "LOOKUP_DOCUMENT_ERROR" });
      }
    },
    [dispatch],
  );

  // Consulta automática: assim que o CNPJ fica completo e válido, os dados são
  // preenchidos sozinhos — não existe botão "Consultar".
  useEffect(() => {
    if (!isValidCnpj(state.document)) return;
    if (requestedDocumentRef.current === state.document) return;

    const digits = state.document;
    const timer = setTimeout(() => runDocumentLookup(digits), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.document, runDocumentLookup]);

  /** Mesmo desenho da consulta de CNPJ: ver `requestedDocumentRef` acima. */
  const requestedCepRef = useRef<string | null>(null);

  const runCepLookup = useCallback(
    async (digits: string) => {
      requestedCepRef.current = digits;
      dispatch({ type: "LOOKUP_CEP_START" });
      try {
        const address = await lookupCep(digits);
        if (requestedCepRef.current !== digits) return;
        dispatch({ type: "LOOKUP_CEP_SUCCESS", address });
      } catch {
        if (requestedCepRef.current !== digits) return;
        requestedCepRef.current = null;
        dispatch({ type: "LOOKUP_CEP_ERROR" });
      }
    },
    [dispatch],
  );

  // CEP também preenche sozinho, sem botão "Buscar CEP".
  useEffect(() => {
    // Com CNPJ o endereço já vem da BrasilAPI. Sem esta guarda, o CEP que a
    // consulta do CNPJ preencheu dispararia uma busca no ViaCEP que
    // sobrescreveria o endereço recém-preenchido (e apagaria o número).
    if (documentType === "cnpj") return;
    if (state.address.zip.length !== 8) return;
    if (requestedCepRef.current === state.address.zip) return;

    const digits = state.address.zip;
    const timer = setTimeout(() => runCepLookup(digits), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.address.zip, documentType, runCepLookup]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Quem está pedindo o orçamento?</h2>
        <p className="text-muted-foreground text-sm">
          Usamos seu CPF ou CNPJ só para identificar o pedido e preencher o endereço mais rápido.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <FormField
          label="CPF ou CNPJ"
          name="document"
          inputMode="numeric"
          placeholder="Digite o CPF ou o CNPJ"
          value={formatDocument(state.document)}
          error={documentError}
          onFocus={() => setDocumentFocused(true)}
          onBlur={() => setDocumentFocused(false)}
          onChange={(event) =>
            dispatch({
              type: "SET_DOCUMENT",
              digits: onlyDigits(event.target.value).slice(0, 14),
            })
          }
        />

        {/* O preenchimento acontece sem ação do cliente, então o estado
            precisa ser anunciado para leitor de tela. */}
        <div aria-live="polite">
          {state.documentLookupStatus === "loading" ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
              Consultando o CNPJ e preenchendo os dados…
            </p>
          ) : null}

          {state.documentLookupStatus === "done" ? (
            <p className="text-muted-foreground text-xs">
              Dados preenchidos automaticamente. Confira e ajuste se precisar.
            </p>
          ) : null}

          {state.documentLookupStatus === "error" ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-destructive text-sm">
                Não encontramos esse CNPJ. Confira os números ou preencha os dados manualmente
                abaixo.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runDocumentLookup(state.document)}
              >
                <SearchIcon />
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <FormField
        label={documentType === "cnpj" ? "Razão social" : "Nome completo"}
        name="legal-name"
        placeholder={
          documentType === "cnpj"
            ? "Preenchido automaticamente ao digitar o CNPJ"
            : "Nome de quem está pedindo"
        }
        value={state.legalName}
        onChange={(event) =>
          dispatch({ type: "SET_FIELD", field: "legalName", value: event.target.value })
        }
      />

      {documentType === "cnpj" ? (
        <FormField
          label="Nome do responsável"
          name="contact-name"
          placeholder="Quem está solicitando o orçamento"
          value={state.contactName}
          onChange={(event) =>
            dispatch({ type: "SET_FIELD", field: "contactName", value: event.target.value })
          }
        />
      ) : null}

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

        {documentType !== "cnpj" ? (
          <div className="flex flex-col gap-1.5">
            <FormField
              label="CEP"
              name="zip"
              inputMode="numeric"
              placeholder="00000-000"
              value={formatCep(state.address.zip)}
              onChange={(event) =>
                dispatch({ type: "SET_CEP", digits: onlyDigits(event.target.value).slice(0, 8) })
              }
            />

            <div aria-live="polite">
              {state.cepLookupStatus === "loading" ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
                  Buscando o endereço do CEP…
                </p>
              ) : null}

              {state.cepLookupStatus === "done" ? (
                <p className="text-muted-foreground text-xs">
                  Endereço preenchido automaticamente. Falta só o número.
                </p>
              ) : null}

              {state.cepLookupStatus === "error" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-destructive text-sm">
                    Não encontramos esse CEP. Confira o número ou preencha o endereço manualmente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => runCepLookup(state.address.zip)}
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
