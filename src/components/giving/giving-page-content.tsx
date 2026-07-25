import Link from "next/link";
import { ArrowUpRight, BarChart3, HandCoins, Wallet } from "lucide-react";

import {
  CreateGivingTransactionForm,
  type GivingAccountOption,
  type GivingFundOption,
  type GivingMemberOption,
} from "@/components/giving/create-giving-transaction-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { GivingData } from "@/lib/data/giving-repository";
import { getMonthDateRange } from "@/lib/data/query-helpers";
import type { FundRow, GivingTransactionRow } from "@/lib/data/types/rows";

const summaryLabels = [
  "Giving This Month",
  "Year-to-Date Giving",
  "Average Gift",
  "Active Givers",
] as const;

const insightLabels = [
  "Top giving fund",
  "Largest gift this month",
] as const;

const navigationLinks = [
  {
    id: "members",
    label: "Members",
    href: "/members",
    description: "Review member profiles",
    icon: Wallet,
  },
  {
    id: "funds",
    label: "Funds",
    href: "/funds",
    description: "Inspect designated fund balances",
    icon: HandCoins,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Open financial reports",
    icon: BarChart3,
  },
] as const;

type GivingPageContentProps = {
  data: GivingData;
  memberOptions?: GivingMemberOption[];
  fundOptions?: GivingFundOption[];
  debitAccountOptions?: GivingAccountOption[];
  revenueAccountOptions?: GivingAccountOption[];
  defaultDebitAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
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

function getRecordedThisMonthTransactions(
  transactions: GivingTransactionRow[],
): GivingTransactionRow[] {
  const { startDate, endDate } = getMonthDateRange();

  return transactions.filter(
    (transaction) =>
      transaction.status === "recorded" &&
      transaction.transaction_date >= startDate &&
      transaction.transaction_date <= endDate,
  );
}

function sumTransactionAmounts(transactions: GivingTransactionRow[]): number {
  return transactions.reduce(
    (total, transaction) => total + Number(transaction.amount),
    0,
  );
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: GivingData,
  monthTransactions: GivingTransactionRow[],
): string {
  switch (label) {
    case "Giving This Month":
      return formatCurrency(data.summary.givingThisMonth);
    case "Year-to-Date Giving":
      return formatCurrency(data.summary.yearToDateGiving);
    case "Average Gift":
      if (monthTransactions.length === 0) {
        return formatCurrency(0);
      }
      return formatCurrency(
        sumTransactionAmounts(monthTransactions) / monthTransactions.length,
      );
    case "Active Givers":
      return String(data.summary.activeGiverCount);
    default:
      return "Unavailable";
  }
}

function buildFundBreakdown(
  funds: FundRow[],
  monthTransactions: GivingTransactionRow[],
): Array<{ fund: FundRow; amount: number }> {
  const totalsByFundId = new Map<string, number>();

  for (const transaction of monthTransactions) {
    if (!transaction.fund_id) {
      continue;
    }

    const currentTotal = totalsByFundId.get(transaction.fund_id) ?? 0;
    totalsByFundId.set(
      transaction.fund_id,
      currentTotal + Number(transaction.amount),
    );
  }

  return funds.map((fund) => ({
    fund,
    amount: totalsByFundId.get(fund.id) ?? 0,
  }));
}

function getTopGivingFundLabel(
  fundBreakdown: Array<{ fund: FundRow; amount: number }>,
): string {
  const topFund = fundBreakdown.reduce<{ fund: FundRow; amount: number } | null>(
    (currentTop, entry) => {
      if (entry.amount <= 0) {
        return currentTop;
      }

      if (!currentTop || entry.amount > currentTop.amount) {
        return entry;
      }

      return currentTop;
    },
    null,
  );

  if (!topFund) {
    return "No data available yet.";
  }

  return `${topFund.fund.name} (${formatCurrency(topFund.amount)})`;
}

function getLargestGiftThisMonth(
  monthTransactions: GivingTransactionRow[],
): string {
  if (monthTransactions.length === 0) {
    return "No data available yet.";
  }

  const largestAmount = Math.max(
    ...monthTransactions.map((transaction) => Number(transaction.amount)),
  );

  return formatCurrency(largestAmount);
}

function formatInsightValue(
  label: (typeof insightLabels)[number],
  fundBreakdown: Array<{ fund: FundRow; amount: number }>,
  monthTransactions: GivingTransactionRow[],
): string {
  switch (label) {
    case "Top giving fund":
      return getTopGivingFundLabel(fundBreakdown);
    case "Largest gift this month":
      return getLargestGiftThisMonth(monthTransactions);
    default:
      return "No data available yet.";
  }
}

function hasGivingActivity(data: GivingData): boolean {
  return (
    data.transactions.length > 0 ||
    data.summary.givingThisMonth > 0 ||
    data.summary.yearToDateGiving > 0
  );
}

function formatTransactionLabel(transaction: GivingTransactionRow): string {
  const amount = formatCurrency(Number(transaction.amount));
  const method = transaction.giving_method.replaceAll("_", " ");
  const reference = transaction.reference ? ` · ${transaction.reference}` : "";

  return `${amount} · ${method}${reference}`;
}

export function GivingPageContent({
  data,
  memberOptions = [],
  fundOptions = [],
  debitAccountOptions = [],
  revenueAccountOptions = [],
  defaultDebitAccountId = null,
  defaultRevenueAccountId = null,
}: GivingPageContentProps) {
  const givingNav = getNavItemByPathname("/giving");

  if (!givingNav) {
    throw new Error("Giving navigation item is not configured.");
  }

  const monthTransactions = getRecordedThisMonthTransactions(data.transactions);
  const fundBreakdown = buildFundBreakdown(data.funds, monthTransactions);
  const recentTransactions = data.transactions.slice(0, 10);

  return (
    <section aria-labelledby="giving-title" className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1
              id="giving-title"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {givingNav.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {givingNav.description}
            </p>
          </div>
          <CreateGivingTransactionForm
            debitAccountOptions={debitAccountOptions}
            fundOptions={fundOptions}
            memberOptions={memberOptions}
            revenueAccountOptions={revenueAccountOptions}
            defaultDebitAccountId={defaultDebitAccountId}
            defaultRevenueAccountId={defaultRevenueAccountId}
          />
        </div>
      </header>

      {!hasGivingActivity(data) ? (
        <WorkspaceDataEmpty message="No giving transactions yet." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSummaryValue(label, data, monthTransactions)}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="giving-recent-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="giving-recent-title"
              className="text-lg font-semibold text-foreground"
            >
              Recent Giving
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest recorded gifts across all funds.
            </p>
          </div>

          <div className="mt-6">
            {recentTransactions.length === 0 ? (
              <WorkspaceDataEmpty message="No giving transactions yet." />
            ) : (
              <ul className="space-y-3">
                {recentTransactions.map((transaction) => {
                  const postedToLedger = Boolean(transaction.journal_entry_id);

                  return (
                    <li
                      key={transaction.id}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-foreground">
                          {formatTransactionLabel(transaction)}
                        </p>
                        <span
                          className={
                            postedToLedger
                              ? "rounded-md border border-[#1677FF]/30 px-2 py-0.5 text-[0.68rem] text-[#1677FF]"
                              : "rounded-md border border-[#FFB547]/35 px-2 py-0.5 text-[0.68rem] text-[#FFB547]"
                          }
                        >
                          {postedToLedger
                            ? "Posted to ledger"
                            : "Not posted to ledger"}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {formatDate(transaction.transaction_date)} ·{" "}
                        {transaction.status}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm" type="button" variant="outline">
                          <Link href={`/giving/${transaction.id}`}>
                            {postedToLedger ? "View" : "Post to ledger"}
                          </Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="giving-fund-breakdown-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="giving-fund-breakdown-title"
                className="text-lg font-semibold text-foreground"
              >
                Fund Breakdown
              </h2>
              <p className="text-sm text-muted-foreground">
                Month-to-date giving by designated fund.
              </p>
            </div>

            {data.funds.length === 0 ? (
              <div className="mt-6">
                <WorkspaceDataEmpty message="No funds configured yet." />
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {fundBreakdown.map(({ fund, amount }) => (
                  <li
                    key={fund.id}
                    className="rounded-lg border border-border/70 bg-muted/20 p-4"
                  >
                    <p className="font-medium text-foreground">{fund.name}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {amount > 0
                        ? formatCurrency(amount)
                        : "No giving recorded yet."}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="giving-insights-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="giving-insights-title"
                className="text-lg font-semibold text-foreground"
              >
                Giving Insights
              </h2>
              <p className="text-sm text-muted-foreground">
                Highlights from the current giving period.
              </p>
            </div>

            <dl className="mt-6 space-y-4">
              {insightLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-2 text-sm text-muted-foreground">
                    {formatInsightValue(label, fundBreakdown, monthTransactions)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="giving-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="giving-related-workspaces-title"
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

export type { GivingPageContentProps };
