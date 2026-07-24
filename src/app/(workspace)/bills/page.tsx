import { BillsPageContent } from "@/components/bills/bills-page-content";
import { getAccountingData } from "@/lib/data/accounting-repository";
import { getBillCashAccountOptions } from "@/lib/data/bill-payment-options";
import { getBillsData } from "@/lib/data/bills-repository";
import {
  mapExpenseAccountOptions,
  mapExpenseFundOptions,
} from "@/lib/data/expense-allocation-options";
import { getFundsData } from "@/lib/data/funds-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import { getVendorsData } from "@/lib/data/vendors-repository";

export default async function BillsPage() {
  const organizationId = await getCurrentOrganizationId();
  const [data, vendorsData, accountingData, fundsData, cashAccountOptions] =
    await Promise.all([
      getBillsData(organizationId),
      getVendorsData(organizationId),
      getAccountingData(organizationId),
      getFundsData(organizationId),
      getBillCashAccountOptions(organizationId),
    ]);

  const expenseAccountOptions = mapExpenseAccountOptions(accountingData.accounts);
  const fundOptions = mapExpenseFundOptions(fundsData.funds);

  return (
    <BillsPageContent
      data={data}
      vendorOptions={vendorsData.vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
      }))}
      expenseAccountOptions={expenseAccountOptions.map((account) => ({
        id: account.id,
        label: account.label,
      }))}
      cashAccountOptions={cashAccountOptions.map((account) => ({
        id: account.id,
        label: account.label,
      }))}
      fundOptions={fundOptions.map((fund) => ({
        id: fund.id,
        label: fund.label,
      }))}
    />
  );
}
