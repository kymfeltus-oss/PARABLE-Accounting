import { BudgetsPageContent } from "@/components/budgets/budgets-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getBudgetsData } from "@/lib/data/budgets-repository";

export default async function BudgetsPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getBudgetsData(organizationId);

  return <BudgetsPageContent data={data} />;
}
