import { BankingPageContent } from "@/components/banking/banking-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getBankingData } from "@/lib/data/banking-repository";

export default async function BankingPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getBankingData(organizationId);

  return <BankingPageContent data={data} />;
}
