import { ReportsPageContent } from "@/components/reports/reports-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getReportsData } from "@/lib/data/reports-repository";

export default async function ReportsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getReportsData(organizationId);

  return <ReportsPageContent data={data} />;
}
