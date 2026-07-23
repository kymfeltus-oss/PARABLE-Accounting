import type { DashboardData } from "@/lib/data/dashboard-repository";
import type { ExpensesData } from "@/lib/data/expenses-repository";
import type { FundsData } from "@/lib/data/funds-repository";
import { FinancialOverviewDashboard } from "./financial-overview-dashboard";

type DashboardPageContentProps = {
  data: DashboardData;
  expensesData?: ExpensesData;
  fundsData?: FundsData;
};

export function DashboardPageContent({
  data,
  expensesData,
  fundsData,
}: DashboardPageContentProps) {
  return (
    <FinancialOverviewDashboard
      data={data}
      expensesData={expensesData}
      fundsData={fundsData}
    />
  );
}

export type { DashboardPageContentProps };
