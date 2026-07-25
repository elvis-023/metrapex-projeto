import type { Metadata } from "next";

import { PdfTemplateForm } from "@/components/settings/pdf-template-form";
import { initialPdfTemplate } from "@/lib/settings/mock-data";

export const metadata: Metadata = { title: "Template de PDF" };

export default function SettingsPdfTemplatePage() {
  return <PdfTemplateForm initialTemplate={initialPdfTemplate} />;
}
