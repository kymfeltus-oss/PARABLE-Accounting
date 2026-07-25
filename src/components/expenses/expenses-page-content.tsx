"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import {
  countDraftsNeedingAllocation,
  filterExpenses,
  getExpenseStatusCounts,
  sortActiveExpenses,
  type ExpenseStatusFilterId,
} from "@/components/expenses/expense-list-filtering";
import { ExpenseListToolbar } from "@/components/expenses/expense-list-toolbar";
import { ExpenseStatusBadge } from "@/components/expenses/expense-status-badge";
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
  defaultExpenseAccountId?: string | null;
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
  defaultExpenseAccountId: string | null,
) {
  if (expense.status !== "draft") {
    return null;
  }

  return (
    <ExpenseAllocationEditor
      accountOptions={accountOptions}
      defaultExpenseAccountId={defaultExpenseAccountId}
      expense={toAllocationEditorExpense(expense)}
      fundOptions={fundOptions}
    />
  );
}

function ExpenseListItem({
  expense,
  accountOptions,
  fundOptions,
  defaultExpenseAccountId,
}: {
  expense: ExpenseRecord;
  accountOptions: ExpenseAccountOption[];
  fundOptions: ExpenseFundOption[];
  defaultExpenseAccountId: string | null;
}) {
  return (
    <li className="rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{expense.description}</p>
            <ExpenseStatusBadge expense={expense} />
          </div>
          <p className="font-medium tabular-nums text-foreground">
            {formatCurrency(Number(expense.total_amount))}
          </p>
          <dl className="grid gap-1 text-muted-foreground">
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt className="sr-only">Expense date</dt>
              <dd>{formatDate(expense.expense_date)}</dd>
            </div>
            {expense.reference ? (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt className="font-medium text-foreground">Reference:</dt>
                <dd>{expense.reference}</dd>
              </div>
            ) : null}
            {expense.vendorName ? (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <dt className="font-medium text-foreground">Vendor:</dt>
                <dd>{expense.vendorName}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt className="font-medium text-foreground">Payment source:</dt>
              <dd>{formatPaymentSource(expense.payment_source)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <dt className="font-medium text-foreground">Allocation:</dt>
              <dd>{formatAllocationDetail(expense)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <Button asChild size="sm" type="button" variant="outline">
          <Link href={`/expenses/${expense.id}`}>View</Link>
        </Button>
        {expense.status === "draft"
          ? renderDraftAllocationControls(
              expense,
              accountOptions,
              fundOptions,
              defaultExpenseAccountId,
            )
          : null}
      </div>
    </li>
  );
}

function ExpenseListEmptyState({
  activeExpenseCount,
  statusFilter,
  searchQuery,
  onShowAll,
}: {
  activeExpenseCount: number;
  statusFilter: ExpenseStatusFilterId;
  searchQuery: string;
  onShowAll: () => void;
}) {
  if (activeExpenseCount === 0) {
    return (
      <WorkspaceDataEmpty message="No expenses yet. Create an expense draft to get started." />
    );
  }

  const trimmedSearch = searchQuery.trim();
  const hasSearch = trimmedSearch.length > 0;
  const hasStatusFilter = statusFilter !== "all";

  if (hasSearch && hasStatusFilter) {
    return (
      <div className="space-y-3">
        <WorkspaceDataEmpty message="No expenses match the current search and status filter." />
        <Button size="sm" type="button" variant="outline" onClick={onShowAll}>
          Show all expenses
        </Button>
      </div>
    );
  }

  if (hasSearch) {
    return (
      <WorkspaceDataEmpty message="No expenses match your search. Clear the search field to restore results." />
    );
  }

  if (hasStatusFilter) {
    return (
      <div className="space-y-3">
        <WorkspaceDataEmpty message="No expenses match the selected status filter." />
        <Button size="sm" type="button" variant="outline" onClick={onShowAll}>
          Show all expenses
        </Button>
      </div>
    );
  }

  return <WorkspaceDataEmpty message="No expenses match the current filter." />;
}

function NeedsAttentionSummary({
  draftCount,
  needsAllocationCount,
}: {
  draftCount: number;
  needsAllocationCount: number;
}) {
  if (draftCount === 0) {
    return <WorkspaceDataEmpty message="No draft expenses." />;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
      <p className="font-medium text-foreground">
        {draftCount} draft expense{draftCount === 1 ? "" : "s"} awaiting recording
      </p>
      {needsAllocationCount > 0 ? (
        <p className="text-muted-foreground">
          {needsAllocationCount} draft
          {needsAllocationCount === 1 ? "" : "s"} still need allocation before
          recording.
        </p>
      ) : (
        <p className="text-muted-foreground">
          All current drafts have allocation lines assigned.
        </p>
      )}
      <p className="text-muted-foreground">
        Review and allocate draft expenses in the expense list. Allocation controls
        open from each draft row.
      </p>
    </div>
  );
}

export function ExpensesPageContent({
  data,
  vendorOptions,
  accountOptions,
  fundOptions,
  defaultExpenseAccountId = null,
}: ExpensesPageContentProps) {
  const expensesNav = getNavItemByPathname("/expenses");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatusFilterId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!expensesNav) {
    throw new Error("Expenses navigation item is not configured.");
  }

  const activeExpenses = useMemo(
    () => sortActiveExpenses(data.expenses),
    [data.expenses],
  );
  const statusCounts = useMemo(
    () => getExpenseStatusCounts(data.expenses),
    [data.expenses],
  );
  const filteredExpenses = useMemo(
    () => filterExpenses(data.expenses, statusFilter, searchQuery),
    [data.expenses, searchQuery, statusFilter],
  );
  const draftCount = statusCounts.draft;
  const needsAllocationCount = useMemo(
    () => countDraftsNeedingAllocation(data.expenses),
    [data.expenses],
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
              Expenses
            </h2>
            <p className="text-sm text-muted-foreground">
              All ministry expenses with search and status filters.
            </p>
          </div>

          <div className="mt-6">
            <ExpenseListToolbar
              searchQuery={searchQuery}
              statusCounts={statusCounts}
              statusFilter={statusFilter}
              onClearSearch={() => setSearchQuery("")}
              onSearchQueryChange={setSearchQuery}
              onStatusFilterChange={setStatusFilter}
            />
          </div>

          <div
            aria-live="polite"
            className="mt-6"
            role="status"
          >
            <p className="sr-only">
              Showing {filteredExpenses.length} of {activeExpenses.length} expenses
            </p>
            {filteredExpenses.length === 0 ? (
              <ExpenseListEmptyState
                activeExpenseCount={activeExpenses.length}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onShowAll={() => setStatusFilter("all")}
              />
            ) : (
              <ul className="space-y-3">
                {filteredExpenses.map((expense) => (
                  <ExpenseListItem
                    key={expense.id}
                    accountOptions={accountOptions}
                    defaultExpenseAccountId={defaultExpenseAccountId}
                    expense={expense}
                    fundOptions={fundOptions}
                  />
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
              Draft expense summary and allocation follow-up.
            </p>
          </div>

          <div className="mt-6">
            <NeedsAttentionSummary
              draftCount={draftCount}
              needsAllocationCount={needsAllocationCount}
            />
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
