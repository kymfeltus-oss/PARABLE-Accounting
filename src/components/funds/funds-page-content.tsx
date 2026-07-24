import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  HandCoins,
  PieChart,
  Receipt,
} from "lucide-react";

import { CreateFundForm } from "@/components/funds/create-fund-form";
import { EditFundForm } from "@/components/funds/edit-fund-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { FundRecord, FundsData } from "@/lib/data/funds-repository";

const summaryLabels = [
  "Total Funds",
  "Funds With Giving",
  "Funds With Expenses",
  "Funds With Budget Allocations",
] as const;

const navigationLinks = [
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    description: "Review recorded gifts by fund",
    icon: HandCoins,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/expenses",
    description: "Inspect expense allocations by fund",
    icon: Receipt,
  },
  {
    id: "budgets",
    label: "Budgets",
    href: "/budgets",
    description: "Review budget line allocations by fund",
    icon: PieChart,
  },
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Open ledger and posting workflows",
    icon: BookOpen,
  },
] as const;

type FundsPageContentProps = {
  data: FundsData;
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

function formatFundType(fundType: string): string {
  return fundType.replace(/_/g, " ");
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: FundsData,
): string {
  switch (label) {
    case "Total Funds":
      return String(data.counts.total);
    case "Funds With Giving":
      return String(data.counts.withGiving);
    case "Funds With Expenses":
      return String(data.counts.withExpenses);
    case "Funds With Budget Allocations":
      return String(data.counts.withBudgetAllocations);
    default:
      return "0";
  }
}

function formatAllocationSummary(fund: FundRecord): string {
  const parts: string[] = [];

  if (fund.givingTransactionCount > 0) {
    parts.push(
      `Giving ${formatCurrency(fund.givingTotalAmount)} (${fund.givingTransactionCount} transaction${fund.givingTransactionCount === 1 ? "" : "s"})`,
    );
  }

  if (fund.expenseLineCount > 0) {
    parts.push(
      `Expenses ${formatCurrency(fund.expenseAllocationTotal)} (${fund.expenseLineCount} line${fund.expenseLineCount === 1 ? "" : "s"})`,
    );
  }

  if (fund.billLineCount > 0) {
    parts.push(
      `Bills ${formatCurrency(fund.billAllocationTotal)} (${fund.billLineCount} line${fund.billLineCount === 1 ? "" : "s"})`,
    );
  }

  if (fund.budgetLineCount > 0) {
    parts.push(
      `Budget ${formatCurrency(fund.budgetAllocationTotal)} (${fund.budgetLineCount} line${fund.budgetLineCount === 1 ? "" : "s"})`,
    );
  }

  if (parts.length === 0) {
    return "No related giving, expense, bill, or budget activity yet.";
  }

  return parts.join(" · ");
}

function hasFundActivity(data: FundsData): boolean {
  return data.funds.length > 0;
}

export function FundsPageContent({ data }: FundsPageContentProps) {
  const fundsNav = getNavItemByPathname("/funds");

  if (!fundsNav) {
    throw new Error("Funds navigation item is not configured.");
  }

  const recentFunds = [...data.funds]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )
    .slice(0, 10);

  return (
    <section aria-labelledby="funds-title" className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              id="funds-title"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {fundsNav.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {fundsNav.description}
            </p>
          </div>
          <CreateFundForm />
        </div>
      </header>

      {!hasFundActivity(data) ? (
        <WorkspaceDataEmpty message="No funds yet." />
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
        Ledger-derived fund balances as of {formatDate(data.asOfDate)} from posted
        journal activity (credit minus debit by fund).
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="funds-directory-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="funds-directory-title"
              className="text-lg font-semibold text-foreground"
            >
              Fund Directory
            </h2>
            <p className="text-sm text-muted-foreground">
              Designated funds with type, status, and allocation activity.
            </p>
          </div>

          <div className="mt-6">
            {data.funds.length === 0 ? (
              <WorkspaceDataEmpty message="No funds yet." />
            ) : (
              <ul className="space-y-3">
                {recentFunds.map((fund) => (
                  <li
                    key={fund.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {fund.name}
                          {fund.code ? ` · ${fund.code}` : ""}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {formatFundType(fund.fund_type)} · {fund.status} · Added{" "}
                          {formatDate(fund.created_at)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {formatAllocationSummary(fund)}
                        </p>
                    <p className="mt-1 text-muted-foreground">
                      Ledger balance {formatCurrency(fund.ledgerBalance)}
                    </p>
                      </div>
                      <EditFundForm fund={fund} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="funds-activity-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="funds-activity-title"
              className="text-lg font-semibold text-foreground"
            >
              Fund Activity
            </h2>
            <p className="text-sm text-muted-foreground">
              Giving, expense, bill, and budget totals by fund.
            </p>
          </div>

          <div className="mt-6">
            {data.funds.length === 0 ? (
              <WorkspaceDataEmpty message="No fund activity yet." />
            ) : (
              <ul className="space-y-3">
                {recentFunds
                  .filter(
                    (fund) =>
                      fund.givingTransactionCount > 0 ||
                      fund.expenseLineCount > 0 ||
                      fund.billLineCount > 0 ||
                      fund.budgetLineCount > 0,
                  )
                  .map((fund) => (
                    <li
                      key={fund.id}
                      className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                    >
                      <p className="font-medium text-foreground">{fund.name}</p>
                      <p className="mt-2 text-muted-foreground">
                        {formatAllocationSummary(fund)}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Ledger balance {formatCurrency(fund.ledgerBalance)}
                      </p>
                    </li>
                  ))}
                {recentFunds.every(
                  (fund) =>
                    fund.givingTransactionCount === 0 &&
                    fund.expenseLineCount === 0 &&
                    fund.billLineCount === 0 &&
                    fund.budgetLineCount === 0,
                ) ? (
                  <WorkspaceDataEmpty message="No related giving, expense, bill, or budget activity yet." />
                ) : null}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="funds-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="funds-related-workspaces-title"
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

export type { FundsPageContentProps };
