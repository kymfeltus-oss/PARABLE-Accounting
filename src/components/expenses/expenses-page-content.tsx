import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  FileText,
  Landmark,
} from "lucide-react";

import {
  CreateExpenseDraftForm,
  type ExpenseVendorOption,
} from "@/components/expenses/create-expense-draft-form";
import { ExpenseAllocationEditor } from "@/components/expenses/expense-allocation-editor";
import type {
  ExpenseAccountOption,
  ExpenseFundOption,
} from "@/lib/data/expense-allocation-options";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { ExpenseRecord, ExpensesData } from "@/lib/data/expenses-repository";

const summaryLabels = [
  "Total Expenses",
  "Total Amount",
  "Expenses This Month",
  "Amount This Month",
] as const;

const navigationLinks = [
  {
    id: "bills",
    label: "Bills",
    href: "/bills",
    description: "Review vendor payables awaiting payment",
    icon: FileText,
  },
  {
    id: "vendors",
    label: "Vendors",
    href: "/vendors",
    description: "Inspect vendor and payee profiles",
    icon: Building2,
  },
  {
    id: "banking",
    label: "Banking",
    href: "/banking",
    description: "Review cash accounts tied to expense payments",
    icon: Landmark,
  },
] as const;

type ExpensesPageContentProps = {
  data: ExpensesData;
  vendorOptions: ExpenseVendorOption[];
  accountOptions: ExpenseAccountOption[];
  fundOptions: ExpenseFundOption[];
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

function formatPaymentSource(source: string): string {
  return source.replace(/_/g, " ");
}

function formatExpenseReference(expense: ExpenseRecord): string {
  if (expense.reference) {
    return expense.reference;
  }

  return expense.description;
}

function formatAllocationDetail(expense: ExpenseRecord): string {
  if (expense.lineCount === 0) {
    return "No allocation lines recorded";
  }

  return `${expense.lineCount} allocation line${expense.lineCount === 1 ? "" : "s"}`;
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: ExpensesData,
): string {
  switch (label) {
    case "Total Expenses":
      return String(data.counts.total);
    case "Total Amount":
      return formatCurrency(data.summary.totalAmount);
    case "Expenses This Month":
      return String(data.counts.thisMonth);
    case "Amount This Month":
      return formatCurrency(data.summary.amountThisMonth);
    default:
      return "0";
  }
}

function hasExpenseActivity(data: ExpensesData): boolean {
  return data.expenses.some((expense) => expense.status !== "void");
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

function renderDraftAllocationControls(
  expense: ExpenseRecord,
  accountOptions: ExpenseAccountOption[],
  fundOptions: ExpenseFundOption[],
) {
  if (expense.status !== "draft") {
    return null;
  }

  return (
    <ExpenseAllocationEditor
      accountOptions={accountOptions}
      expense={toAllocationEditorExpense(expense)}
      fundOptions={fundOptions}
    />
  );
}

export function ExpensesPageContent({
  data,
  vendorOptions,
  accountOptions,
  fundOptions,
}: ExpensesPageContentProps) {
  const expensesNav = getNavItemByPathname("/expenses");

  if (!expensesNav) {
    throw new Error("Expenses navigation item is not configured.");
  }

  const activeExpenses = data.expenses.filter(
    (expense) => expense.status !== "void",
  );
  const recentExpenses = activeExpenses.slice(0, 10);
  const draftExpenses = activeExpenses.filter(
    (expense) => expense.status === "draft",
  );

  return (
    <section aria-labelledby="expenses-title" className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              id="expenses-title"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {expensesNav.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {expensesNav.description}
            </p>
          </div>
          <CreateExpenseDraftForm vendorOptions={vendorOptions} />
        </div>
      </header>

      {!hasExpenseActivity(data) ? (
        <WorkspaceDataEmpty message="No expenses yet." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSummaryValue(label, data)}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="expenses-list-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="expenses-list-title"
              className="text-lg font-semibold text-foreground"
            >
              Recent Expenses
            </h2>
            <p className="text-sm text-muted-foreground">
              Recorded ministry expenses with vendor, date, and amount details.
            </p>
          </div>

          <div className="mt-6">
            {activeExpenses.length === 0 ? (
              <WorkspaceDataEmpty message="No expenses yet." />
            ) : (
              <ul className="space-y-3">
                {recentExpenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {expense.vendorName ?? "No vendor recorded"} ·{" "}
                      {formatExpenseReference(expense)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatDate(expense.expense_date)} ·{" "}
                      {formatCurrency(Number(expense.total_amount))} ·{" "}
                      {expense.status}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatPaymentSource(expense.payment_source)} ·{" "}
                      {formatAllocationDetail(expense)}
                    </p>
                    {expense.status === "draft" ? (
                      <div className="mt-3">
                        {renderDraftAllocationControls(
                          expense,
                          accountOptions,
                          fundOptions,
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="expenses-attention-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="expenses-attention-title"
              className="text-lg font-semibold text-foreground"
            >
              Needs Attention
            </h2>
            <p className="text-sm text-muted-foreground">
              Draft expenses awaiting final recording.
            </p>
          </div>

          <div className="mt-6">
            {draftExpenses.length === 0 ? (
              <WorkspaceDataEmpty message="No draft expenses." />
            ) : (
              <ul className="space-y-3">
                {draftExpenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {expense.vendorName ?? "No vendor recorded"}
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      {formatExpenseReference(expense)} ·{" "}
                      {formatDate(expense.expense_date)} ·{" "}
                      {formatCurrency(Number(expense.total_amount))}
                    </p>
                    {expense.lineCount === 0 ? (
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Needs allocation
                      </p>
                    ) : null}
                    <div className="mt-3">
                      {renderDraftAllocationControls(
                        expense,
                        accountOptions,
                        fundOptions,
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="expenses-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="expenses-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected ministry accounting areas.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {navigationLinks.map((link) => (
            <li key={link.id}>
              <Button
                asChild
                className="h-auto w-full justify-start px-3 py-3"
                variant="outline"
              >
                <Link href={link.href}>
                  <link.icon aria-hidden className="size-4" />
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="inline-flex items-center gap-1 font-medium">
                      {link.label}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

export type { ExpensesPageContentProps };
