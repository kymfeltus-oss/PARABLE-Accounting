import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getDashboardData } from "@/lib/data/dashboard-repository";

export default async function DashboardPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getDashboardData(organizationId);

  return <DashboardPageContent data={data} />;
}
