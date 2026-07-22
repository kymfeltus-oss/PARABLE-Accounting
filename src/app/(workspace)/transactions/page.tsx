import { TransactionsPageContent } from "@/components/transactions/transactions-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getTransactionsData } from "@/lib/data/transactions-repository";

export default async function TransactionsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getTransactionsData(organizationId);

  return <TransactionsPageContent data={data} />;
}
