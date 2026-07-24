import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  PieChart,
  Receipt,
  Wallet,
} from "lucide-react";

import { CloseAccountingPeriodButton } from "@/components/accounting/close-accounting-period-button";
import { CreateAccountForm } from "@/components/accounting/create-account-form";
import { CreateAccountingPeriodForm } from "@/components/accounting/create-accounting-period-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type {
  AccountingData,
  AccountingPeriodRecord,
  JournalEntryRecord,
} from "@/lib/data/accounting-repository";

const summaryLabels = [
  "Total Accounts",
  "Open Accounting Periods",
  "Posted Journal Entries",
  "Draft Journal Entries",
] as const;

const navigationLinks = [
  {
    id: "transactions",
    label: "Transactions",
    href: "/transactions",
    description: "Review posted financial activity",
    icon: Receipt,
  },
  {
    id: "funds",
    label: "Funds",
    href: "/funds",
    description: "Inspect designated fund assignments",
    icon: Wallet,
  },
  {
    id: "budgets",
    label: "Budgets",
    href: "/budgets",
    description: "Review budget allocations",
    icon: PieChart,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Open financial reporting workspaces",
    icon: FileText,
  },
] as const;

type AccountingPageContentProps = {
  data: AccountingData;
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

function formatDateRange(period: AccountingPeriodRecord): string {
  return `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`;
}

function formatAccountType(accountType: string): string {
  return accountType.replace(/_/g, " ");
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: AccountingData,
): string {
  switch (label) {
    case "Total Accounts":
      return String(data.counts.totalAccounts);
    case "Open Accounting Periods":
      return String(data.counts.openPeriods);
    case "Posted Journal Entries":
      return String(data.counts.postedJournalEntries);
    case "Draft Journal Entries":
      return String(data.counts.draftJournalEntries);
    default:
      return "0";
  }
}

function formatBalancedState(entry: JournalEntryRecord): string {
  if (entry.lineCount === 0) {
    return "No lines";
  }

  return entry.isBalanced ? "Balanced" : "Unbalanced";
}

function hasAccountingActivity(data: AccountingData): boolean {
  return (
    data.accounts.length > 0 ||
    data.periods.length > 0 ||
    data.journalEntries.length > 0
  );
}

export function AccountingPageContent({ data }: AccountingPageContentProps) {
  const accountingNav = getNavItemByPathname("/accounting");

  if (!accountingNav) {
    throw new Error("Accounting navigation item is not configured.");
  }

  const recentJournalEntries = data.journalEntries.slice(0, 10);

  return (
    <section aria-labelledby="accounting-title" className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              id="accounting-title"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {accountingNav.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {accountingNav.description}
            </p>
          </div>
          <CreateAccountForm />
        </div>
      </header>

      {!hasAccountingActivity(data) ? (
        <WorkspaceDataEmpty message="No accounting records yet." />
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
        Account balances and trial balance as of {formatDate(data.asOfDate)} from
        posted journal activity.
      </p>

      <section
        aria-labelledby="accounting-trial-balance-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="accounting-trial-balance-title"
            className="text-lg font-semibold text-foreground"
          >
            Trial Balance
          </h2>
          <p className="text-sm text-muted-foreground">
            Posted debit and credit balances by account through{" "}
            {formatDate(data.asOfDate)}.
            {data.trialBalance.isBalanced ? " Books are balanced." : " Out of balance."}
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          {data.trialBalance.rows.length === 0 ? (
            <WorkspaceDataEmpty message="No posted account balances yet." />
          ) : (
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <caption className="sr-only">Trial balance</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium text-foreground">Account</th>
                  <th className="px-3 py-2 font-medium text-foreground">Type</th>
                  <th className="px-3 py-2 font-medium text-foreground">Debit</th>
                  <th className="px-3 py-2 font-medium text-foreground">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.trialBalance.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.code} · {row.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatAccountType(row.accountType)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.debitBalance > 0 ? formatCurrency(row.debitBalance) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.creditBalance > 0 ? formatCurrency(row.creditBalance) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium text-foreground">
                  <td className="px-3 py-2" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-3 py-2">
                    {formatCurrency(data.trialBalance.totalDebits)}
                  </td>
                  <td className="px-3 py-2">
                    {formatCurrency(data.trialBalance.totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="accounting-chart-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="accounting-chart-title"
              className="text-lg font-semibold text-foreground"
            >
              Chart of Accounts
            </h2>
            <p className="text-sm text-muted-foreground">
              Organization account codes, names, types, and status.
            </p>
          </div>

          <div className="mt-6">
            {data.accounts.length === 0 ? (
              <WorkspaceDataEmpty message="No accounts yet." />
            ) : (
              <ul className="space-y-3">
                {data.accounts.map((account) => (
                  <li
                    key={account.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {account.code} · {account.name}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatAccountType(account.account_type)} · {account.status}
                      {account.parent_account_id
                        ? " · Sub-account"
                        : " · Top-level"}
                      {" · Balance "}
                      {formatCurrency(account.balance)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="accounting-periods-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2
                id="accounting-periods-title"
                className="text-lg font-semibold text-foreground"
              >
                Accounting Periods
              </h2>
              <p className="text-sm text-muted-foreground">
                Period names, date ranges, and status.
              </p>
            </div>
            <CreateAccountingPeriodForm />
          </div>

          <div className="mt-6">
            {data.periods.length === 0 ? (
              <WorkspaceDataEmpty message="No accounting periods yet." />
            ) : (
              <ul className="space-y-3">
                {data.periods.map((period) => (
                  <li
                    key={period.id}
                    className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                  >
                    <p className="font-medium text-foreground">{period.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {formatDateRange(period)} · {period.status}
                      {period.isCurrent ? " · Current period" : ""}
                    </p>
                    <CloseAccountingPeriodButton period={period} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="accounting-journals-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="accounting-journals-title"
            className="text-lg font-semibold text-foreground"
          >
            Recent Journal Entries
          </h2>
          <p className="text-sm text-muted-foreground">
            Entry date, reference, description, status, and line totals.
          </p>
        </div>

        <div className="mt-6">
          {data.journalEntries.length === 0 ? (
            <WorkspaceDataEmpty message="No journal entries yet." />
          ) : (
            <ul className="space-y-3">
              {recentJournalEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {formatDate(entry.entry_date)} · {entry.entry_number}
                  </p>
                  <p className="mt-1 text-muted-foreground">{entry.description}</p>
                  <p className="mt-1 text-muted-foreground">
                    {entry.status} · {entry.lineCount} line
                    {entry.lineCount === 1 ? "" : "s"} · Debits{" "}
                    {formatCurrency(entry.debitTotal)} · Credits{" "}
                    {formatCurrency(entry.creditTotal)} ·{" "}
                    {formatBalancedState(entry)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="accounting-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="accounting-related-workspaces-title"
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

export type { AccountingPageContentProps };
