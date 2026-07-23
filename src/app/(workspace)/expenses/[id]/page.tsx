import { notFound } from "next/navigation";
import type { ComponentProps } from "react";

import { ExpenseDetailPageContent } from "@/components/expenses/expense-detail-page-content";
import { getAccountingData } from "@/lib/data/accounting-repository";
import {
  mapExpenseAccountOptions,
  mapExpenseFundOptions,
} from "@/lib/data/expense-allocation-options";
import { getExpenseCreditAccountOptions } from "@/lib/data/expense-credit-account-options";
import {
  getExpenseJournalLinkage,
  type ExpenseJournalLinkage,
} from "@/lib/data/expense-journal-linkage";
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

export type ExpenseDetailPagePreparedData = {
  journalLinkage: ExpenseJournalLinkage | null;
};

type ExpenseDetailPageViewProps = ExpenseDetailPagePreparedData &
  ComponentProps<typeof ExpenseDetailPageContent>;

export function ExpenseDetailPageView({
  journalLinkage,
  ...contentProps
}: ExpenseDetailPageViewProps) {
  return (
    <ExpenseDetailPageContent
      {...contentProps}
      journalLinkage={journalLinkage}
    />
  );
}

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

  const [lines, accountingData, fundsData, creditAccountOptions, journalLinkage] =
    await Promise.all([
      getExpenseLines(organizationId, id),
      getAccountingData(organizationId),
      getFundsData(organizationId),
      expense.status === "draft"
        ? getExpenseCreditAccountOptions(
            organizationId,
            expense.payment_source,
          )
        : Promise.resolve([]),
      expense.status === "recorded"
        ? getExpenseJournalLinkage(organizationId, id)
        : Promise.resolve(null),
    ]);

  return (
    <ExpenseDetailPageView
      accountOptions={mapExpenseAccountOptions(accountingData.accounts)}
      creditAccountOptions={creditAccountOptions}
      expense={expense}
      fundOptions={mapExpenseFundOptions(fundsData.funds)}
      journalLinkage={journalLinkage}
      lines={lines}
    />
  );
}
