import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  PieChart,
  Receipt,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { BudgetRecord, BudgetsData } from "@/lib/data/budgets-repository";

const summaryLabels = [
  "Total Budgets",
  "Budgets With Lines",
  "Total Budgeted Amount",
  "Current Budgets",
] as const;

const navigationLinks = [
  {
    id: "funds",
    label: "Funds",
    href: "/funds",
    description: "Review designated fund allocations",
    icon: Wallet,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/expenses",
    description: "Inspect expense line allocations",
    icon: Receipt,
  },
  {
    id: "bills",
    label: "Bills",
    href: "/bills",
    description: "Review bill line allocations",
    icon: FileText,
  },
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Open ledger and posting workflows",
    icon: BookOpen,
  },
] as const;

type BudgetsPageContentProps = {
  data: BudgetsData;
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

function formatDateRange(budget: BudgetRecord): string {
  return `${formatDate(budget.start_date)} – ${formatDate(budget.end_date)}`;
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: BudgetsData,
): string {
  switch (label) {
    case "Total Budgets":
      return String(data.counts.total);
    case "Budgets With Lines":
      return String(data.counts.withLines);
    case "Total Budgeted Amount":
      return formatCurrency(data.summary.totalBudgetedAmount);
    case "Current Budgets":
      return String(data.counts.current);
    default:
      return "0";
  }
}

function formatFundAllocations(budget: BudgetRecord): string {
  if (budget.fundAllocations.length === 0) {
    return "No fund allocations recorded.";
  }

  return budget.fundAllocations
    .map(
      (allocation) =>
        `${allocation.fundName ?? "Unknown fund"} ${formatCurrency(allocation.budgetedAmount)}`,
    )
    .join(" · ");
}

function formatAccountAllocations(budget: BudgetRecord): string {
  if (budget.accountAllocations.length === 0) {
    return "No account allocations recorded.";
  }

  return budget.accountAllocations
    .map(
      (allocation) =>
        `${allocation.accountName ?? "Unknown account"} ${formatCurrency(allocation.budgetedAmount)}`,
    )
    .join(" · ");
}

function hasBudgetActivity(data: BudgetsData): boolean {
  return data.budgets.length > 0;
}

export function BudgetsPageContent({ data }: BudgetsPageContentProps) {
  const budgetsNav = getNavItemByPathname("/budgets");

  if (!budgetsNav) {
    throw new Error("Budgets navigation item is not configured.");
  }

  const recentBudgets = [...data.budgets]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )
    .slice(0, 10);

  return (
    <section aria-labelledby="budgets-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="budgets-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {budgetsNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {budgetsNav.description}
        </p>
      </header>

      {!hasBudgetActivity(data) ? (
        <WorkspaceDataEmpty message="No budgets yet." />
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

      <p className="text-sm text-muted-foreground">
        Actual-to-budget comparison unavailable with the current allocation
        model.
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="budgets-list-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="budgets-list-title"
              className="text-lg font-semibold text-foreground"
            >
              Budget Plans
            </h2>
            <p className="text-sm text-muted-foreground">
              Budget periods with line totals and status.
            </p>
          </div>

          <div className="mt-6">
            {data.budgets.length === 0 ? (
              <WorkspaceDataEmpty message="No budgets yet." />
            ) : (
              <ul className="space-y-3">
                {recentBudgets.map((budget) => (
                  <li
                    key={budget.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">{budget.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {formatDateRange(budget)} · {budget.status}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {budget.lineCount} line{budget.lineCount === 1 ? "" : "s"}{" "}
                      · {formatCurrency(budget.totalBudgetedAmount)} · Added{" "}
                      {formatDate(budget.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="budgets-allocations-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="budgets-allocations-title"
              className="text-lg font-semibold text-foreground"
            >
              Allocation Summary
            </h2>
            <p className="text-sm text-muted-foreground">
              Fund and account totals from budget lines.
            </p>
          </div>

          <div className="mt-6">
            {data.budgets.length === 0 ? (
              <WorkspaceDataEmpty message="No budget allocations yet." />
            ) : (
              <ul className="space-y-3">
                {recentBudgets
                  .filter((budget) => budget.lineCount > 0)
                  .map((budget) => (
                    <li
                      key={budget.id}
                      className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                    >
                      <p className="font-medium text-foreground">{budget.name}</p>
                      <p className="mt-2 text-muted-foreground">
                        Funds: {formatFundAllocations(budget)}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Accounts: {formatAccountAllocations(budget)}
                      </p>
                    </li>
                  ))}
                {recentBudgets.every((budget) => budget.lineCount === 0) ? (
                  <WorkspaceDataEmpty message="No budget lines recorded yet." />
                ) : null}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="budgets-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="budgets-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected ministry accounting areas.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

export type { BudgetsPageContentProps };
