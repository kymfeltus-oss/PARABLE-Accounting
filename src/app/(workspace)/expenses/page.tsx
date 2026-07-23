import { ExpensesPageContent } from "@/components/expenses/expenses-page-content";
import { getAccountingData } from "@/lib/data/accounting-repository";
import {
  mapExpenseAccountOptions,
  mapExpenseFundOptions,
} from "@/lib/data/expense-allocation-options";
import { getExpensesData } from "@/lib/data/expenses-repository";
import { getFundsData } from "@/lib/data/funds-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getVendorsData } from "@/lib/data/vendors-repository";

export default async function ExpensesPage() {
  const organizationId = await getCurrentOrganizationId();
  const [data, vendorsData, accountingData, fundsData] = await Promise.all([
    getExpensesData(organizationId),
    getVendorsData(organizationId),
    getAccountingData(organizationId),
    getFundsData(organizationId),
  ]);

  return (
    <ExpensesPageContent
      data={data}
      vendorOptions={vendorsData.vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
      }))}
      accountOptions={mapExpenseAccountOptions(accountingData.accounts)}
      fundOptions={mapExpenseFundOptions(fundsData.funds)}
    />
  );
}
