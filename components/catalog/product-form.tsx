"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageOffIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  createProductAction,
  updateProductAction,
  uploadProductPhotoAction,
} from "@/lib/catalog/actions";
import { parseBrPrice } from "@/lib/catalog/money";
import { cn } from "@/lib/utils";
import type { Product, ProductCategory } from "@/lib/catalog/types";

const NO_CATEGORY = "none";

type ProductFormValues = {
  externalCode: string;
  name: string;
  price: string;
  stock: string;
  categoryId: string;
  photoUrl: string | null;
  alternativeTitle: string;
  catalogUrl: string;
  manualUrl: string;
  videoUrl: string;
  certificateEligible: boolean;
  leadTime: string;
};

function toFormValues(product?: Product): ProductFormValues {
  return {
    externalCode: product?.externalCode ?? "",
    name: product?.name ?? "",
    price: product ? product.price.toFixed(2).replace(".", ",") : "",
    stock: product ? String(product.stock) : "",
    categoryId: product?.categoryId ?? NO_CATEGORY,
    photoUrl: product?.photoUrl ?? null,
    alternativeTitle: product?.alternativeTitle ?? "",
    catalogUrl: product?.catalogUrl ?? "",
    manualUrl: product?.manualUrl ?? "",
    videoUrl: product?.videoUrl ?? "",
    certificateEligible: product?.certificateEligible ?? false,
    leadTime: product?.leadTime ?? "",
  };
}

/** Aceita "34,90", "34.90" ou "34" — mesma tolerância da importação de planilha. */
function isValidPrice(value: string): boolean {
  return parseBrPrice(value) !== null;
}

export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ProductFormValues>(() => toFormValues(product));
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(product);

  function setField<K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { url } = await uploadProductPhotoAction(formData);
      setField("photoUrl", url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Record<keyof ProductFormValues, string>> = {};
    if (!values.externalCode.trim()) nextErrors.externalCode = "Código externo obrigatório.";
    if (!values.name.trim()) nextErrors.name = "Nome obrigatório.";
    if (!values.price.trim()) {
      nextErrors.price = "Preço obrigatório.";
    } else if (!isValidPrice(values.price)) {
      nextErrors.price = "Preço mal formatado — use vírgula para centavos (ex.: 12,50).";
    }
    if (!values.stock.trim() || Number.isNaN(Number(values.stock))) {
      nextErrors.stock = "Estoque obrigatório e numérico.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      externalCode: values.externalCode,
      name: values.name,
      price: values.price,
      stock: values.stock,
      categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
      photoUrl: values.photoUrl,
      alternativeTitle: values.alternativeTitle,
      catalogUrl: values.catalogUrl,
      manualUrl: values.manualUrl,
      videoUrl: values.videoUrl,
      certificateEligible: values.certificateEligible,
      leadTime: values.leadTime,
    };

    setIsSubmitting(true);
    try {
      if (isEditing && product) {
        await updateProductAction(product.id, input);
        toast.success("Produto atualizado.");
      } else {
        await createProductAction(input);
        toast.success("Produto cadastrado.");
      }
      router.push("/catalog");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md">
              {values.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.photoUrl} alt="" className="size-full object-cover" />
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
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon />
                {isUploadingPhoto
                  ? "Enviando..."
                  : values.photoUrl
                    ? "Trocar foto"
                    : "Selecionar foto"}
              </Button>
              <p className="text-muted-foreground text-xs">JPG ou PNG, até 5MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="externalCode" className="text-sm font-medium">
                Código externo
              </label>
              <Input
                id="externalCode"
                value={values.externalCode}
                onChange={(event) => setField("externalCode", event.target.value)}
                aria-invalid={Boolean(errors.externalCode)}
                className={cn(errors.externalCode && "border-destructive")}
              />
              {errors.externalCode ? (
                <p className="text-destructive text-sm">{errors.externalCode}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium">
                Categoria
              </label>
              <Select
                value={values.categoryId}
                onValueChange={(value) => value && setField("categoryId", value)}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === NO_CATEGORY
                        ? "Sem categoria"
                        : (categories.find((category) => category.id === value)?.name ?? "—")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nome
              </label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                aria-invalid={Boolean(errors.name)}
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preço e estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="price" className="text-sm font-medium">
                Preço
              </label>
              <Input
                id="price"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={values.price}
                onChange={(event) => setField("price", event.target.value)}
                aria-invalid={Boolean(errors.price)}
                className={cn("tabular-nums", errors.price && "border-destructive")}
              />
              {errors.price ? <p className="text-destructive text-sm">{errors.price}</p> : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="stock" className="text-sm font-medium">
                Estoque
              </label>
              <Input
                id="stock"
                inputMode="numeric"
                value={values.stock}
                onChange={(event) => setField("stock", event.target.value)}
                aria-invalid={Boolean(errors.stock)}
                className={cn("tabular-nums", errors.stock && "border-destructive")}
              />
              {errors.stock ? <p className="text-destructive text-sm">{errors.stock}</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campos complementares</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alternativeTitle" className="text-sm font-medium">
              Título alternativo
            </label>
            <Input
              id="alternativeTitle"
              value={values.alternativeTitle}
              onChange={(event) => setField("alternativeTitle", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="catalogUrl" className="text-sm font-medium">
                Link do catálogo
              </label>
              <Input
                id="catalogUrl"
                type="url"
                value={values.catalogUrl}
                onChange={(event) => setField("catalogUrl", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="manualUrl" className="text-sm font-medium">
                Link do manual
              </label>
              <Input
                id="manualUrl"
                type="url"
                value={values.manualUrl}
                onChange={(event) => setField("manualUrl", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="videoUrl" className="text-sm font-medium">
                Link do vídeo
              </label>
              <Input
                id="videoUrl"
                type="url"
                value={values.videoUrl}
                onChange={(event) => setField("videoUrl", event.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={values.certificateEligible}
                onChange={(event) => setField("certificateEligible", event.target.checked)}
                className="accent-primary size-4 rounded-[calc(var(--radius)-2px)]"
              />
              Elegível para certificado
            </label>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="leadTime" className="text-sm font-medium">
                Prazo de entrega
              </label>
              <Input
                id="leadTime"
                placeholder="Ex.: Entrega imediata, 5 dias úteis"
                value={values.leadTime}
                onChange={(event) => setField("leadTime", event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/catalog")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar produto"}
        </Button>
      </div>
    </form>
  );
}
