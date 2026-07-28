import type { Metadata } from "next";

import { CustomReportBuilder } from "@/components/reports/custom-report-builder";
import { getOrgSellers } from "@/lib/reports/queries";

export const metadata: Metadata = { title: "Relatório customizável" };

export default async function CustomReportPage() {
  const sellers = await getOrgSellers();
  return <CustomReportBuilder sellers={sellers} />;
}
