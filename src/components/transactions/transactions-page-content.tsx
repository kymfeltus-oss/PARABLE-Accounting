import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  Landmark,
  Receipt,
} from "lucide-react";

import { CreateBankTransactionForm } from "@/components/banking/create-bank-transaction-form";
import { MatchBankTransactionForm } from "@/components/transactions/match-bank-transaction-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { TransactionsData } from "@/lib/data/transactions-repository";
import type {
  BankTransactionMatchRow,
  BankTransactionRow,
} from "@/lib/data/types/rows";

const summaryLabels = [
  "Total Transactions",
  "Unmatched",
  "Matched",
  "Excluded",
] as const;

const matchReviewLabels = [
  "Proposed matches",
  "Confirmed matches",
  "Rejected matches",
  "Unmatched amount",
] as const;

const navigationLinks = [
  {
    id: "banking",
    label: "Banking",
    href: "/banking",
    description: "Review account balances and reconciliation status",
    icon: Landmark,
  },
  {
    id: "bills",
    label: "Bills",
    href: "/bills",
    description: "Inspect payables linked to bank activity",
    icon: FileText,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/expenses",
    description: "Review expense records for matching",
    icon: Receipt,
  },
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Open ledger and posting workflows",
    icon: BookOpen,
  },
] as const;

type TransactionsPageContentProps = {
  data: TransactionsData;
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

function countMatchesByStatus(
  matches: BankTransactionMatchRow[],
  status: string,
): number {
  return matches.filter((match) => match.status === status).length;
}

function sumUnmatchedAmount(transactions: BankTransactionRow[]): number {
  return transactions
    .filter((transaction) => transaction.status === "unmatched")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  counts: TransactionsData["counts"],
): string {
  switch (label) {
    case "Total Transactions":
      return String(counts.total);
    case "Unmatched":
      return String(counts.unmatched);
    case "Matched":
      return String(counts.matched);
    case "Excluded":
      return String(counts.excluded);
    default:
      return "0";
  }
}

function formatMatchReviewValue(
  label: (typeof matchReviewLabels)[number],
  data: TransactionsData,
): string {
  switch (label) {
    case "Proposed matches":
      return String(countMatchesByStatus(data.matches, "proposed"));
    case "Confirmed matches":
      return String(countMatchesByStatus(data.matches, "confirmed"));
    case "Rejected matches":
      return String(countMatchesByStatus(data.matches, "rejected"));
    case "Unmatched amount":
      return formatCurrency(sumUnmatchedAmount(data.transactions));
    default:
      return "Unavailable";
  }
}

function formatTransactionLabel(transaction: BankTransactionRow): string {
  const reference = transaction.reference ? ` · ${transaction.reference}` : "";
  return `${formatCurrency(Number(transaction.amount))} · ${transaction.description}${reference}`;
}

function formatMatchLabel(match: BankTransactionMatchRow): string {
  return `${formatCurrency(Number(match.matched_amount))} · ${match.source_type} · ${match.status}`;
}

function hasTransactionActivity(data: TransactionsData): boolean {
  return data.transactions.length > 0 || data.matches.length > 0;
}

export function TransactionsPageContent({ data }: TransactionsPageContentProps) {
  const transactionsNav = getNavItemByPathname("/transactions");

  if (!transactionsNav) {
    throw new Error("Transactions navigation item is not configured.");
  }

  const recentTransactions = data.transactions.slice(0, 10);
  const recentMatches = data.matches.slice(0, 10);

  return (
    <section aria-labelledby="transactions-title" className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1
            id="transactions-title"
            className="text-3xl font-semibold tracking-tight text-foreground"
          >
            {transactionsNav.title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {transactionsNav.description}
          </p>
        </div>

        <CreateBankTransactionForm bankAccounts={data.bankAccounts} />
      </header>

      {!hasTransactionActivity(data) ? (
        <WorkspaceDataEmpty message="No transactions yet." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSummaryValue(label, data.counts)}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="transactions-table-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="transactions-table-title"
              className="text-lg font-semibold text-foreground"
            >
              Transactions
            </h2>
            <p className="text-sm text-muted-foreground">
              Recent bank activity with source and match status.
            </p>
          </div>

          <div className="mt-6">
            {recentTransactions.length === 0 ? (
              <WorkspaceDataEmpty message="No transactions yet." />
            ) : (
              <ul className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {formatTransactionLabel(transaction)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatDate(transaction.transaction_date)} ·{" "}
                      {transaction.source_type} · {transaction.status}
                    </p>
                    {transaction.status === "unmatched" ? (
                      <MatchBankTransactionForm
                        bankTransactionId={transaction.id}
                        transactionLabel={transaction.description}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="transactions-match-review-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="transactions-match-review-title"
                className="text-lg font-semibold text-foreground"
              >
                Match Review
              </h2>
              <p className="text-sm text-muted-foreground">
                Current matching queue and unmatched exposure.
              </p>
            </div>

            <dl className="mt-6 space-y-4">
              {matchReviewLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-2 text-sm text-muted-foreground">
                    {formatMatchReviewValue(label, data)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            aria-labelledby="transactions-attention-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="transactions-attention-title"
                className="text-lg font-semibold text-foreground"
              >
                Attention
              </h2>
              <p className="text-sm text-muted-foreground">
                Unmatched bank transactions that still need review.
              </p>
            </div>

            <div className="mt-6 rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">
                Unmatched transactions
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {data.counts.unmatched > 0
                  ? `${data.counts.unmatched} transaction${data.counts.unmatched === 1 ? "" : "s"}`
                  : "No unmatched transactions."}
              </p>
            </div>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="transactions-recent-match-activity-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="transactions-recent-match-activity-title"
            className="text-lg font-semibold text-foreground"
          >
            Recent Match Activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest proposed, confirmed, and rejected matches.
          </p>
        </div>

        <div className="mt-6">
          {recentMatches.length === 0 ? (
            <WorkspaceDataEmpty message="No match activity yet." />
          ) : (
            <ul className="space-y-3">
              {recentMatches.map((match) => (
                <li
                  key={match.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {formatMatchLabel(match)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {formatDate(match.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="transactions-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="transactions-related-workspaces-title"
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

export type { TransactionsPageContentProps };
