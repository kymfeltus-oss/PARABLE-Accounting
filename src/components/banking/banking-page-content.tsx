import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
} from "lucide-react";

import { CreateBankAccountForm } from "@/components/banking/create-bank-account-form";
import { CreateBankTransactionForm } from "@/components/banking/create-bank-transaction-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { BankingData, BankAccountRecord } from "@/lib/data/banking-repository";
import type { BankTransactionRow } from "@/lib/data/types/rows";

const summaryLabels = [
  "Total Ledger Cash",
  "Bank Accounts",
  "Unmatched Transactions",
  "Reconciliation Progress",
] as const;

const navigationIcons = {
  transactions: ArrowLeftRight,
  accounting: BookOpen,
  reports: BarChart3,
} as const;

const navigationLinks = [
  {
    id: "transactions",
    label: "Transactions",
    href: "/transactions",
    description: "Review bank activity and matching status",
  },
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Inspect ledger and posting workflows",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Open financial reports",
  },
] as const;

type BankingPageContentProps = {
  data: BankingData;
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

function countUnmatchedForAccount(
  accountId: string,
  transactions: BankTransactionRow[],
): number {
  return transactions.filter(
    (transaction) =>
      transaction.bank_account_id === accountId &&
      transaction.status === "unmatched",
  ).length;
}

function formatReconciliationProgress(data: BankingData): string {
  if (data.counts.transactionCount === 0) {
    return "No transactions yet";
  }

  const matchedPercent = Math.round(
    (data.counts.matchedTransactionCount / data.counts.transactionCount) * 100,
  );

  return `${matchedPercent}% matched`;
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: BankingData,
): string {
  switch (label) {
    case "Total Ledger Cash":
      return formatCurrency(data.counts.totalLedgerCashBalance);
    case "Reconciliation Progress":
      return formatReconciliationProgress(data);
    case "Bank Accounts":
      return String(data.counts.accountCount);
    case "Unmatched Transactions":
      return String(data.counts.unmatchedTransactionCount);
    default:
      return "0";
  }
}

function formatAccountDetails(account: BankAccountRecord): string {
  const institution = account.institution_name ?? "Institution not recorded";
  const lastFour = account.last_four ? ` · ****${account.last_four}` : "";

  return `${institution} · ${account.account_type}${lastFour} · ${account.status}`;
}

function formatReconciliationStatus(
  account: BankAccountRecord,
  transactions: BankTransactionRow[],
): string {
  const unmatchedCount = countUnmatchedForAccount(account.id, transactions);

  if (unmatchedCount > 0) {
    return `${unmatchedCount} unmatched transaction${unmatchedCount === 1 ? "" : "s"}`;
  }

  return "No unmatched transactions.";
}

function formatTransactionLabel(transaction: BankTransactionRow): string {
  return `${formatCurrency(Number(transaction.amount))} · ${transaction.description}`;
}

function hasBankingActivity(data: BankingData): boolean {
  return data.accounts.length > 0 || data.transactions.length > 0;
}

export function BankingPageContent({ data }: BankingPageContentProps) {
  const bankingNav = getNavItemByPathname("/banking");

  if (!bankingNav) {
    throw new Error("Banking navigation item is not configured.");
  }

  const recentTransactions = data.transactions.slice(0, 10);

  return (
    <section aria-labelledby="banking-title" className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1
            id="banking-title"
            className="text-3xl font-semibold tracking-tight text-foreground"
          >
            {bankingNav.title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {bankingNav.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <CreateBankAccountForm assetAccounts={data.assetAccounts} />
          <CreateBankTransactionForm
            bankAccounts={data.accounts.map((account) => ({
              id: account.id,
              name: account.name,
            }))}
          />
        </div>
      </header>

      {!hasBankingActivity(data) ? (
        <WorkspaceDataEmpty message="No bank accounts or transactions yet." />
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="banking-accounts-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="banking-accounts-title"
              className="text-lg font-semibold text-foreground"
            >
              Bank Accounts
            </h2>
            <p className="text-sm text-muted-foreground">
              Recorded ministry bank accounts and linked ledger cash balances.
            </p>
          </div>

          <div className="mt-6">
            {data.accounts.length === 0 ? (
              <WorkspaceDataEmpty message="No bank accounts yet." />
            ) : (
              <ul className="space-y-3">
                {data.accounts.map((account) => (
                  <li
                    key={account.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">{account.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {formatAccountDetails(account)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Ledger balance: {formatCurrency(account.ledgerBalance)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="banking-reconciliation-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="banking-reconciliation-title"
                className="text-lg font-semibold text-foreground"
              >
                Reconciliation Status
              </h2>
              <p className="text-sm text-muted-foreground">
                Progress and unreconciled item counts by account.
              </p>
            </div>

            {data.accounts.length === 0 ? (
              <div className="mt-6">
                <WorkspaceDataEmpty message="No reconciliation data yet." />
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {data.accounts.map((account) => (
                  <li
                    key={account.id}
                    className="rounded-lg border border-border/70 bg-muted/20 p-4"
                  >
                    <p className="font-medium text-foreground">{account.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatReconciliationStatus(account, data.transactions)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="banking-attention-title"
            className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="space-y-1">
              <h2
                id="banking-attention-title"
                className="text-lg font-semibold text-foreground"
              >
                Banking Attention
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
                {data.counts.unmatchedTransactionCount > 0
                  ? `${data.counts.unmatchedTransactionCount} transaction${data.counts.unmatchedTransactionCount === 1 ? "" : "s"}`
                  : "No unmatched transactions."}
              </p>
            </div>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="banking-recent-activity-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="banking-recent-activity-title"
            className="text-lg font-semibold text-foreground"
          >
            Recent Bank Activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest recorded bank transactions.
          </p>
        </div>

        <div className="mt-6">
          {recentTransactions.length === 0 ? (
            <WorkspaceDataEmpty message="No bank transactions yet." />
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
                    {transaction.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="banking-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="banking-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected ministry accounting areas.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {navigationLinks.map((link) => {
            const Icon =
              link.id === "transactions"
                ? navigationIcons.transactions
                : link.id === "accounting"
                  ? navigationIcons.accounting
                  : navigationIcons.reports;

            return (
              <li key={link.id}>
                <Button
                  asChild
                  className="h-auto w-full justify-start px-3 py-3"
                  variant="outline"
                >
                  <Link href={link.href}>
                    <Icon aria-hidden className="size-4" />
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
            );
          })}
        </ul>
      </section>
    </section>
  );
}

export type { BankingPageContentProps };
