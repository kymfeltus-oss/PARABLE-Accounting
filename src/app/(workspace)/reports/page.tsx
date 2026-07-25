import { ReportsPageContent } from "@/components/reports/reports-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
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
  const asOf = readSearchParam(params.asOf).trim();
  const periodStart = readSearchParam(params.periodStart).trim();
  const periodEnd = readSearchParam(params.periodEnd).trim();
  const data = await getReportsData(organizationId, {
    asOfDate: asOf || undefined,
    periodStartDate: periodStart || undefined,
    periodEndDate: periodEnd || undefined,
  });

  return <ReportsPageContent data={data} />;
}
