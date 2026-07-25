import { ReportsPageContent } from "@/components/reports/reports-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { resolveReportDateParams } from "@/lib/data/report-date-params";
import { getReportsData } from "@/lib/data/reports-repository";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  const reportDates = resolveReportDateParams({
    asOf: readSearchParam(params.asOf),
    periodStart: readSearchParam(params.periodStart),
    periodEnd: readSearchParam(params.periodEnd),
  });
  const data = await getReportsData(organizationId, reportDates);

  return <ReportsPageContent data={data} />;
}
