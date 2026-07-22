import { ExpensesPageContent } from "@/components/expenses/expenses-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getExpensesData } from "@/lib/data/expenses-repository";

export default async function ExpensesPage() {
  const organizationId = await getCurrentOrganizationId();
  const data = await getExpensesData(organizationId);

  return <ExpensesPageContent data={data} />;
}
