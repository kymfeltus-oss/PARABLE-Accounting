import { AccountingPageContent } from "@/components/accounting/accounting-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getAccountingData } from "@/lib/data/accounting-repository";

export default async function AccountingPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getAccountingData(organizationId);

  return <AccountingPageContent data={data} />;
}
