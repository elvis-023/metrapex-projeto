import type { Metadata } from "next";

import { ReportSchedulesManager } from "@/components/reports/report-schedules-manager";
import { getOrgSellers } from "@/lib/reports/queries";
import { getReportSchedules } from "@/lib/reports/schedules";

export const metadata: Metadata = { title: "Envios agendados" };

export default async function ReportSchedulesPage() {
  const [schedules, sellers] = await Promise.all([getReportSchedules(), getOrgSellers()]);
  return <ReportSchedulesManager initialSchedules={schedules} sellers={sellers} />;
}
