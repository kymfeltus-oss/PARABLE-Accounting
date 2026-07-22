import { FundsPageContent } from "@/components/funds/funds-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getFundsData } from "@/lib/data/funds-repository";

export default async function FundsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getFundsData(organizationId);

  return <FundsPageContent data={data} />;
}
