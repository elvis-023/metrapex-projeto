import { Package } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

export default function CatalogPage() {
  return (
    <EmptyState
      icon={Package}
      title="Catálogo chega no Milestone 6"
      description="Listagem, cadastro e importação de produtos serão construídos aqui."
    />
  );
}
