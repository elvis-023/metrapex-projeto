import type { Metadata } from "next";

import { ProductImportWizard } from "@/components/catalog/product-import-wizard";

export const metadata: Metadata = { title: "Importar catálogo" };

export default function CatalogImportPage() {
  return <ProductImportWizard />;
}
