import { notFound } from "next/navigation";

import { ExpenseDetailPageContent } from "@/components/expenses/expense-detail-page-content";
import { getAccountingData } from "@/lib/data/accounting-repository";
import {
  mapExpenseAccountOptions,
  mapExpenseFundOptions,
} from "@/lib/data/expense-allocation-options";
import {
  getExpenseById,
  getExpenseLines,
} from "@/lib/data/expenses-repository";
import { getFundsData } from "@/lib/data/funds-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type ExpenseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExpenseDetailPage({
  params,
}: ExpenseDetailPageProps) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  const organizationId = await getCurrentOrganizationId();
  const expense = await getExpenseById(organizationId, id);

  if (!expense || expense.status === "void") {
    notFound();
  }

  const [lines, accountingData, fundsData] = await Promise.all([
    getExpenseLines(organizationId, id),
    getAccountingData(organizationId),
    getFundsData(organizationId),
  ]);

  return (
    <ExpenseDetailPageContent
      accountOptions={mapExpenseAccountOptions(accountingData.accounts)}
      expense={expense}
      fundOptions={mapExpenseFundOptions(fundsData.funds)}
      lines={lines}
    />
  );
}
