import { CompliancePageContent } from "@/components/compliance/compliance-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getComplianceData } from "@/lib/data/compliance-repository";

export default async function CompliancePage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getComplianceData(organizationId);

  return <CompliancePageContent data={data} />;
}
