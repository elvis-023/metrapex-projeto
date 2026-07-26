"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CustomerPicker } from "@/components/quotes/customer-picker";
import { ProductPicker } from "@/components/quotes/product-picker";
import { QuoteLineItems } from "@/components/quotes/quote-line-items";
import { QuoteTotalsCard } from "@/components/quotes/quote-totals-card";
import { QuotePdfPreview } from "@/components/quotes/quote-pdf-preview";
import { cn } from "@/lib/utils";
import type { ProductCategory } from "@/lib/catalog/types";
import type { Customer, CustomerSource } from "@/lib/customers/types";
import { saveQuoteAction } from "@/lib/quotes/actions";
import {
  availablePaymentConditions,
  calculateQuote,
  type QuoteBuilderData,
} from "@/lib/quotes/engine";
import { toQuoteView } from "@/lib/quotes/view-model";
import type { QuoteDiscount } from "@/lib/quotes/types";

const steps = [
  { step: 1, label: "Cliente" },
  { step: 2, label: "Produtos" },
  { step: 3, label: "Revisão" },
] as const;

type BuilderStep = (typeof steps)[number]["step"];

export type QuoteBuilderItem = { productId: string; quantity: number };

export function QuoteBuilder({
  data,
  categories,
  customers,
  sources,
  revisionOf = null,
  initialCustomer = null,
  initialItems = [],
  initialDiscount = { type: "fixed", value: 0 },
  omittedProductNames = [],
}: {
  data: QuoteBuilderData;
  categories: ProductCategory[];
  customers: Customer[];
  sources: CustomerSource[];
  /** Preenchido na tela de nova revisão: número e revisão do orçamento de origem. */
  revisionOf?: { id: string; number: string; revision: number } | null;
  initialCustomer?: Customer | null;
  initialItems?: QuoteBuilderItem[];
  initialDiscount?: QuoteDiscount;
  /** Produtos da versão anterior que já saíram do catálogo — avisados, não silenciados. */
  omittedProductNames?: string[];
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [step, setStep] = useState<BuilderStep>(1);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [createdCustomers, setCreatedCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<QuoteBuilderItem[]>(initialItems);
  const [discount, setDiscount] = useState<QuoteDiscount>(initialDiscount);
  const [paymentConditionId, setPaymentConditionId] = useState<string | null>(
    data.paymentConditions.find((condition) => condition.active)?.id ?? null,
  );

  const revision = revisionOf ? revisionOf.revision + 1 : 1;
  const categoryNamesById = useMemo(() => new Map(data.categoryNames), [data.categoryNames]);

  /**
   * MESMA função que o servidor roda ao salvar (`lib/quotes/engine.ts`). Aqui
   * ela existe só para o recálculo instantâneo enquanto o vendedor digita —
   * nada calculado nesta tela é persistido: `saveQuoteAction` recebe apenas
   * produto, quantidade, desconto e condição, e refaz a conta no backend.
   */
  const calculation = useMemo(
    () =>
      calculateQuote({
        items,
        products: data.products,
        categoryNamesById,
        taxTypes: data.taxTypes,
        overrides: data.overrides,
        discount,
        paymentConditionId,
        paymentConditions: data.paymentConditions,
        paymentValueBands: data.paymentValueBands,
      }),
    [items, data, categoryNamesById, discount, paymentConditionId],
  );

  const view = useMemo(() => toQuoteView(calculation), [calculation]);

  const conditionOptions = useMemo(
    () =>
      availablePaymentConditions(
        data.paymentConditions,
        data.paymentValueBands,
        calculation.bandBaseAmount,
      ),
    [data.paymentConditions, data.paymentValueBands, calculation.bandBaseAmount],
  );

  const allCustomers = useMemo(
    () => [...customers, ...createdCustomers],
    [customers, createdCustomers],
  );
  const furthestStepReached = customer ? (items.length > 0 ? 3 : 2) : 1;
  const conditionBlocked = paymentConditionId !== null && !calculation.paymentConditionAllowed;

  function handleAddProduct(productId: string) {
    setItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  }

  function handleChangeQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      handleRemoveItem(productId);
      return;
    }
    setItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    );
  }

  function handleRemoveItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  function handleCreateCustomer(newCustomer: Customer) {
    setCreatedCustomers((current) => [...current, newCustomer]);
    setCustomer(newCustomer);
  }

  function handleSave() {
    if (!customer) return;

    startSaving(async () => {
      try {
        const { id } = await saveQuoteAction({
          customerId: null,
          customerName: customer.name,
          customerDocument: customer.document,
          customerSourceId: customer.sourceId,
          items,
          discount,
          paymentConditionId,
          previousRevisionId: revisionOf?.id ?? null,
        });

        toast.success(
          revisionOf
            ? `Revisão ${revision} de ${revisionOf.number} salva.`
            : "Orçamento salvo como rascunho.",
        );
        router.push(`/pipeline/${id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="gap-4 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm font-medium tabular-nums">
              {revisionOf
                ? `${revisionOf.number} · revisão ${revision}`
                : "Número definido ao salvar"}
            </p>
            {revisionOf ? (
              <p className="text-muted-foreground text-xs">
                Itens recalculados com a configuração de imposto atual — não herdam o snapshot da
                versão anterior.
              </p>
            ) : null}
            {omittedProductNames.length > 0 ? (
              <p className="text-warning-foreground text-xs">
                Fora do catálogo e não incluído nesta revisão: {omittedProductNames.join(", ")}.
              </p>
            ) : null}
          </div>
        </div>

        <ol className="flex items-center gap-1.5">
          {steps.map(({ step: s, label }, index) => {
            const isCompleted = s < step;
            const isCurrent = s === step;
            const isReachable = s <= furthestStepReached || s <= step;

            return (
              <li key={s} className="flex flex-1 items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isReachable}
                  onClick={() => setStep(s)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors disabled:cursor-not-allowed",
                    isReachable && !isCurrent && "hover:bg-muted cursor-pointer",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                      isCompleted && "border-primary bg-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary",
                      !isCompleted && !isCurrent && "border-border text-muted-foreground",
                    )}
                  >
                    {isCompleted ? <CheckIcon className="size-3.5" /> : s}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:inline",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <span
                    className={cn("h-px flex-1", isCompleted ? "bg-primary" : "bg-border")}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardHeader>

      <CardContent className="py-4">
        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-medium">Cliente</h2>
              <p className="text-muted-foreground text-sm">
                Busque um cliente existente ou cadastre um novo para este orçamento.
              </p>
            </div>
            <CustomerPicker
              customers={allCustomers}
              sources={sources}
              selected={customer}
              onSelect={setCustomer}
              onClear={() => setCustomer(null)}
              onCreate={handleCreateCustomer}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-medium">Produtos do catálogo</h2>
                <p className="text-muted-foreground text-sm">
                  Foto, preço e imposto resolvido por produto.
                </p>
              </div>
              <ProductPicker
                products={data.products}
                categories={categories}
                taxTypes={data.taxTypes}
                overrides={data.overrides}
                onAdd={handleAddProduct}
              />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-medium">Itens do orçamento</h2>
                <p className="text-muted-foreground text-sm">
                  {items.length} produto(s) adicionado(s).
                </p>
              </div>
              <QuoteLineItems
                items={view.items}
                onChangeQuantity={handleChangeQuantity}
                onRemove={handleRemoveItem}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <QuoteTotalsCard
              view={view}
              discount={discount}
              onDiscountChange={setDiscount}
              paymentConditionId={paymentConditionId}
              onPaymentConditionChange={setPaymentConditionId}
              conditions={conditionOptions}
              conditionBlocked={conditionBlocked}
            />
            <QuotePdfPreview
              number={revisionOf?.number ?? null}
              revision={revision}
              customerName={customer?.name ?? null}
              customerDocument={customer?.document ?? null}
              view={view}
              discount={discount}
              paymentConditionLabel={
                conditionOptions.find((condition) => condition.id === paymentConditionId)?.label ??
                null
              }
              footerNote={data.documentFooter}
              showTaxLines={data.showTaxLines}
            />
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((current) => (current - 1) as BuilderStep)}
        >
          Voltar
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            disabled={(step === 1 && !customer) || (step === 2 && items.length === 0)}
            onClick={() => setStep((current) => (current + 1) as BuilderStep)}
          >
            Avançar
          </Button>
        ) : (
          <Button type="button" onClick={handleSave} disabled={isSaving || conditionBlocked}>
            {isSaving ? "Salvando…" : "Salvar orçamento"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
