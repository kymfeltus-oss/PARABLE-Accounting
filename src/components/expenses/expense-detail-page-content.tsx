"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ExpenseAllocationEditor } from "@/components/expenses/expense-allocation-editor";
import { RecordExpenseSection } from "@/components/expenses/record-expense-section";
import { ExpenseStatusBadge } from "@/components/expenses/expense-status-badge";
import type {
  ExpenseAccountOption,
  ExpenseFundOption,
} from "@/lib/data/expense-allocation-options";
import type { ExpenseCreditAccountOption } from "@/lib/data/expense-credit-account-options";
import type { ExpenseDraftLineDetail, ExpenseRecord } from "@/lib/data/expenses-repository";

export type ExpenseDetailPageContentProps = {
  expense: ExpenseRecord;
  lines: ExpenseDraftLineDetail[];
  accountOptions: ExpenseAccountOption[];
  fundOptions: ExpenseFundOption[];
  creditAccountOptions: ExpenseCreditAccountOption[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPaymentSource(source: string): string {
  return source.replace(/_/g, " ");
}

function sumLineAmounts(lines: ExpenseDraftLineDetail[]): number {
  return lines.reduce((total, line) => total + line.amount, 0);
}

function isAllocationComplete(
  expense: ExpenseRecord,
  lines: ExpenseDraftLineDetail[],
): boolean {
  if (expense.status !== "draft" || lines.length === 0) {
    return false;
  }

  return sumLineAmounts(lines) === Number(expense.total_amount);
}

function resolveAccountLabel(
  accountId: string,
  accountOptions: ExpenseAccountOption[],
): string {
  return (
    accountOptions.find((option) => option.id === accountId)?.label ?? accountId
  );
}

function resolveFundLabel(
  fundId: string | null,
  fundOptions: ExpenseFundOption[],
): string {
  if (!fundId) {
    return "Unassigned";
  }

  return fundOptions.find((option) => option.id === fundId)?.label ?? fundId;
}

function toAllocationEditorExpense(expense: ExpenseRecord) {
  return {
    id: expense.id,
    description: expense.description,
    reference: expense.reference,
    totalAmount: Number(expense.total_amount),
    status: expense.status,
    lineCount: expense.lineCount,
  };
}

function AllocationSummary({
  expense,
  lines,
}: {
  expense: ExpenseRecord;
  lines: ExpenseDraftLineDetail[];
}) {
  const expenseTotal = Number(expense.total_amount);
  const allocatedTotal = sumLineAmounts(lines);
  const remainingDifference = expenseTotal - allocatedTotal;
  const isIncomplete =
    expense.status === "draft" &&
    (lines.length === 0 || remainingDifference !== 0);

  return (
    <div
      aria-label="Allocation summary"
      className="rounded-md border border-border bg-muted/20 p-4 text-sm"
    >
      <dl className="grid gap-2">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Expense total</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatCurrency(expenseTotal)}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Allocated total</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatCurrency(allocatedTotal)}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Remaining difference</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatCurrency(remainingDifference)}
          </dd>
        </div>
      </dl>
      {isIncomplete ? (
        <p className="mt-3 text-muted-foreground" role="status">
          Allocation is incomplete. Assigned lines must total the expense amount
          before this draft can be recorded.
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyAllocationLines({
  lines,
  accountOptions,
  fundOptions,
}: {
  lines: ExpenseDraftLineDetail[];
  accountOptions: ExpenseAccountOption[];
  fundOptions: ExpenseFundOption[];
}) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No allocation lines recorded.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {lines.map((line) => (
        <li
          key={line.id}
          className="min-w-0 rounded-md border border-border p-3 text-sm"
        >
          <p className="font-medium text-foreground">Line {line.lineNumber}</p>
          <dl className="mt-2 grid gap-1 text-muted-foreground">
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt className="font-medium text-foreground">Account:</dt>
              <dd>{resolveAccountLabel(line.accountId, accountOptions)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt className="font-medium text-foreground">Fund:</dt>
              <dd>{resolveFundLabel(line.fundId, fundOptions)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt className="font-medium text-foreground">Amount:</dt>
              <dd className="tabular-nums">{formatCurrency(line.amount)}</dd>
            </div>
            {line.description ? (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt className="font-medium text-foreground">Description:</dt>
                <dd>{line.description}</dd>
              </div>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function ExpenseDetailPageContent({
  expense,
  lines,
  accountOptions,
  fundOptions,
  creditAccountOptions,
}: ExpenseDetailPageContentProps) {
  const isDraft = expense.status === "draft";
  const isRecorded = expense.status === "recorded";
  const allocationComplete = isAllocationComplete(expense, lines);

  return (
    <section aria-labelledby="expense-detail-title" className="space-y-6">
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/expenses"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to expenses
        </Link>

        <header className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1
                id="expense-detail-title"
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              >
                {expense.description}
              </h1>
              <ExpenseStatusBadge expense={expense} />
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-right">
              {formatCurrency(Number(expense.total_amount))}
            </p>
          </div>
        </header>
      </div>

      <section
        aria-labelledby="expense-detail-fields-title"
        className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
      >
        <h2
          id="expense-detail-fields-title"
          className="text-lg font-semibold text-foreground"
        >
          Expense details
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">Expense date</dt>
            <dd className="mt-1 text-muted-foreground">
              {formatDate(expense.expense_date)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Payment source</dt>
            <dd className="mt-1 text-muted-foreground">
              {formatPaymentSource(expense.payment_source)}
            </dd>
          </div>
          {expense.reference ? (
            <div>
              <dt className="font-medium text-foreground">Reference</dt>
              <dd className="mt-1 text-muted-foreground">{expense.reference}</dd>
            </div>
          ) : null}
          {expense.vendorName ? (
            <div>
              <dt className="font-medium text-foreground">Vendor</dt>
              <dd className="mt-1 text-muted-foreground">{expense.vendorName}</dd>
            </div>
          ) : null}
          {expense.created_at ? (
            <div>
              <dt className="font-medium text-foreground">Created</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDateTime(expense.created_at)}
              </dd>
            </div>
          ) : null}
          {expense.updated_at ? (
            <div>
              <dt className="font-medium text-foreground">Updated</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDateTime(expense.updated_at)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {isRecorded ? (
        <div
          className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground"
          role="status"
        >
          This expense has been recorded and cannot be edited through the draft
          workflow.
        </div>
      ) : null}

      <section
        aria-labelledby="expense-detail-allocation-title"
        className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="expense-detail-allocation-title"
            className="text-lg font-semibold text-foreground"
          >
            Allocation
          </h2>
          <p className="text-sm text-muted-foreground">
            {isDraft
              ? "Review allocation totals and assign draft lines."
              : "Read-only allocation lines for this recorded expense."}
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <AllocationSummary expense={expense} lines={lines} />

          {isDraft ? (
            <ExpenseAllocationEditor
              accountOptions={accountOptions}
              expense={toAllocationEditorExpense(expense)}
              fundOptions={fundOptions}
            />
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Allocation lines
            </h3>
            <div className="mt-3 min-w-0">
              <ReadOnlyAllocationLines
                accountOptions={accountOptions}
                fundOptions={fundOptions}
                lines={lines}
              />
            </div>
          </div>
        </div>
      </section>

      {isDraft && allocationComplete ? (
        <RecordExpenseSection
          allocationComplete={allocationComplete}
          creditAccountOptions={creditAccountOptions}
          expenseAmount={Number(expense.total_amount)}
          expenseDescription={expense.description}
          expenseId={expense.id}
          paymentSource={formatPaymentSource(expense.payment_source)}
        />
      ) : null}
    </section>
  );
}
