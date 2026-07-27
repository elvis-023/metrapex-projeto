import { describe, expect, it } from "vitest";

import { initialPublicFormState, isStepValid, publicFormReducer } from "@/lib/public-form/reducer";
import type { PublicFormState } from "@/lib/public-form/types";

/**
 * O passo 1 libera o botão "Avançar". Como o formulário perdeu o seletor de
 * CPF/CNPJ, essa validação passou a depender do tipo DEDUZIDO do documento —
 * errar aqui trava o cliente na primeira tela ou deixa passar dado incompleto.
 */
function step1State(overrides: Partial<PublicFormState> = {}): PublicFormState {
  return {
    ...initialPublicFormState(null),
    legalName: "Padaria Bom Pão",
    email: "contato@padaria.test",
    phone: "11988887777",
    address: {
      zip: "01310100",
      street: "Av. Paulista",
      number: "1000",
      complement: "",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    },
    ...overrides,
  };
}

describe("isStepValid — passo 1 com tipo deduzido", () => {
  it("CPF válido não exige nome do responsável", () => {
    expect(isStepValid(step1State({ document: "11144477735" }), 1)).toBe(true);
  });

  it("CNPJ válido exige nome do responsável", () => {
    expect(isStepValid(step1State({ document: "11222333000181" }), 1)).toBe(false);
    expect(isStepValid(step1State({ document: "11222333000181", contactName: "Maria" }), 1)).toBe(
      true,
    );
  });

  it("recusa documento com dígito verificador inválido", () => {
    expect(isStepValid(step1State({ document: "11111111111" }), 1)).toBe(false);
    expect(isStepValid(step1State({ document: "11111111111111", contactName: "Maria" }), 1)).toBe(
      false,
    );
  });

  it("recusa documento incompleto (tipo indeterminado)", () => {
    expect(isStepValid(step1State({ document: "" }), 1)).toBe(false);
    expect(isStepValid(step1State({ document: "1112223" }), 1)).toBe(false);
    // 12 dígitos: passou do CPF, ainda não é CNPJ.
    expect(isStepValid(step1State({ document: "112223330001" }), 1)).toBe(false);
  });

  it("recusa quando falta dado comum, mesmo com documento válido", () => {
    expect(isStepValid(step1State({ document: "11144477735", email: "invalido" }), 1)).toBe(false);
    expect(
      isStepValid(
        step1State({ document: "11144477735", address: { ...step1State().address, city: "" } }),
        1,
      ),
    ).toBe(false);
  });
});

describe("publicFormReducer — SET_DOCUMENT", () => {
  it("limpa razão social e endereço vindos da consulta anterior ao trocar o documento", () => {
    const preenchido: PublicFormState = step1State({
      document: "11222333000181",
      legalName: "EMPRESA CONSULTADA LTDA",
      documentLookupStatus: "done",
    });

    const depois = publicFormReducer(preenchido, { type: "SET_DOCUMENT", digits: "1122233300018" });

    expect(depois.legalName).toBe("");
    expect(depois.address.street).toBe("");
    expect(depois.documentLookupStatus).toBe("idle");
  });

  it("preserva o que o cliente digitou à mão (sem consulta automática antes)", () => {
    const manual: PublicFormState = step1State({
      document: "11144477735",
      legalName: "Nome Digitado À Mão",
      documentLookupStatus: "idle",
    });

    const depois = publicFormReducer(manual, { type: "SET_DOCUMENT", digits: "1114447773" });

    expect(depois.legalName).toBe("Nome Digitado À Mão");
    expect(depois.address.street).toBe("Av. Paulista");
  });
});
