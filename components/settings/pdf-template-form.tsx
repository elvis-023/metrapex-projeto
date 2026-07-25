"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImageOffIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PdfTemplateSettings } from "@/lib/settings/types";

export function PdfTemplateForm({ initialTemplate }: { initialTemplate: PdfTemplateSettings }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<PdfTemplateSettings>(initialTemplate);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof PdfTemplateSettings>(field: K, value: PdfTemplateSettings[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setField("logoUrl", typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.issuerName.trim()) {
      setError("Dados da emissora obrigatórios.");
      return;
    }
    setError(null);
    toast.success("Template de PDF atualizado.");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Logo e dados da emissora</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md">
                {values.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={values.logoUrl} alt="" className="size-full object-contain" />
                ) : (
                  <ImageOffIcon className="text-muted-foreground size-5" aria-hidden="true" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon />
                  {values.logoUrl ? "Trocar logo" : "Selecionar logo"}
                </Button>
                <p className="text-muted-foreground text-xs">PNG com fundo transparente, até 2MB.</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="issuer-name" className="text-sm font-medium">
                Razão social
              </label>
              <Input
                id="issuer-name"
                value={values.issuerName}
                onChange={(event) => setField("issuerName", event.target.value)}
                aria-invalid={Boolean(error)}
                className={cn(error && "border-destructive")}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="issuer-document" className="text-sm font-medium">
                  CNPJ
                </label>
                <Input
                  id="issuer-document"
                  value={values.issuerDocument}
                  onChange={(event) => setField("issuerDocument", event.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="issuer-address" className="text-sm font-medium">
                  Endereço
                </label>
                <Input
                  id="issuer-address"
                  value={values.issuerAddress}
                  onChange={(event) => setField("issuerAddress", event.target.value)}
                />
              </div>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Textos do documento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="warranty-text" className="text-sm font-medium">
                Garantia
              </label>
              <textarea
                id="warranty-text"
                rows={2}
                value={values.warrantyText}
                onChange={(event) => setField("warrantyText", event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
              />
            </div>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="terms-text" className="text-sm font-medium">
                Termos e validade
              </label>
              <textarea
                id="terms-text"
                rows={2}
                value={values.termsText}
                onChange={(event) => setField("termsText", event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
              />
            </div>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="shipping-text" className="text-sm font-medium">
                Frete
              </label>
              <textarea
                id="shipping-text"
                rows={2}
                value={values.shippingText}
                onChange={(event) => setField("shippingText", event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Salvar template</Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Prévia do PDF
        </p>
        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
              {values.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.logoUrl} alt="" className="size-full object-contain" />
              ) : (
                <ImageOffIcon className="text-muted-foreground size-4" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{values.issuerName || "Razão social"}</span>
              <span className="text-muted-foreground truncate text-xs tabular-nums">
                {values.issuerDocument}
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{values.issuerAddress}</p>
          <Separator />
          <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
            {values.warrantyText ? <p>{values.warrantyText}</p> : null}
            {values.termsText ? <p>{values.termsText}</p> : null}
            {values.shippingText ? <p>{values.shippingText}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
