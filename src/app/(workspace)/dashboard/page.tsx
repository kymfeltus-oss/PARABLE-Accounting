import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getDashboardData } from "@/lib/data/dashboard-repository";
import { getExpensesData } from "@/lib/data/expenses-repository";
import { getFundsData } from "@/lib/data/funds-repository";

export default async function DashboardPage() {
  const organizationId = await getCurrentOrganizationId();
  const [data, expensesData, fundsData] = await Promise.all([
    getDashboardData(organizationId),
    getExpensesData(organizationId),
    getFundsData(organizationId),
  ]);

  return (
    <DashboardPageContent
      data={data}
      expensesData={expensesData}
      fundsData={fundsData}
    />
  );
}
