"use client";

import { useRouter } from "next/navigation";

import { recordExpenseAction } from "@/app/(workspace)/expenses/actions";
import type { ExpenseCreditAccountOption } from "@/lib/data/expense-credit-account-options";

import {
  RecordExpenseForm,
  type CreditAccountOption,
  type RecordExpenseResult,
} from "./record-expense-form";

type RecordExpenseSectionProps = {
  expenseId: string;
  expenseDescription: string;
  expenseAmount: number;
  paymentSource: string | null;
  allocationComplete: boolean;
  creditAccountOptions: ExpenseCreditAccountOption[];
  defaultCreditAccountId?: string | null;
};

function mapCreditAccountOptions(
  options: ExpenseCreditAccountOption[],
): CreditAccountOption[] {
  return options.map((option) => ({
    id: option.id,
    code: option.code,
    name: option.name,
    accountType: option.accountType,
  }));
}

export function RecordExpenseSection({
  expenseId,
  expenseDescription,
  expenseAmount,
  paymentSource,
  allocationComplete,
  creditAccountOptions,
  defaultCreditAccountId = null,
}: RecordExpenseSectionProps) {
  const router = useRouter();

  async function handleRecord(input: {
    expenseId: string;
    creditAccountId: string;
  }): Promise<RecordExpenseResult> {
    return recordExpenseAction(input);
  }

  return (
    <RecordExpenseForm
      allocationComplete={allocationComplete}
      creditAccounts={mapCreditAccountOptions(creditAccountOptions)}
      defaultCreditAccountId={defaultCreditAccountId}
      expenseAmount={expenseAmount}
      expenseDescription={expenseDescription}
      expenseId={expenseId}
      onRecord={handleRecord}
      onRecorded={() => {
        router.refresh();
      }}
      paymentSource={paymentSource}
    />
  );
}

export type { RecordExpenseSectionProps };
