import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Heart,
  PieChart,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { ReportsData } from "@/lib/data/reports-repository";

const snapshotLabels = [
  "Recorded Giving",
  "Non-Void Expenses",
  "Open Payables",
  "Total Budgeted Amount",
] as const;

const navigationLinks = [
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Review ledger activity and periods",
    icon: BookOpen,
  },
  {
    id: "budgets",
    label: "Budgets",
    href: "/budgets",
    description: "Inspect budget allocations",
    icon: PieChart,
  },
  {
    id: "funds",
    label: "Funds",
    href: "/funds",
    description: "Review designated fund activity",
    icon: Wallet,
  },
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    description: "Open recorded giving transactions",
    icon: Heart,
  },
] as const;

type ReportsPageContentProps = {
  data: ReportsData;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatAccountType(accountType: string): string {
  return accountType.replace(/_/g, " ");
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function FinancialReportTable({
  caption,
  headers,
  rows,
  footer,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
  footer?: string[];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium text-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-3 py-3 text-muted-foreground"
                colSpan={headers.length}
              >
                No posted activity for this report.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${caption}-row-${index}`} className="border-b border-border/70">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${caption}-cell-${index}-${cellIndex}`}
                    className="px-3 py-2 text-muted-foreground"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="border-t border-border font-medium text-foreground">
              {footer.map((cell, index) => (
                <td key={`${caption}-footer-${index}`} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function formatSnapshotValue(
  label: (typeof snapshotLabels)[number],
  data: ReportsData,
): string {
  switch (label) {
    case "Recorded Giving":
      return formatCurrency(data.snapshots.recordedGivingTotal);
    case "Non-Void Expenses":
      return formatCurrency(data.snapshots.nonVoidExpenseTotal);
    case "Open Payables":
      return formatCurrency(data.snapshots.openPayablesAmount);
    case "Total Budgeted Amount":
      return formatCurrency(data.snapshots.totalBudgetedAmount);
    default:
      return formatCurrency(0);
  }
}

function formatAccountsByType(
  accountsByType: ReportsData["summaries"]["accounting"]["accountsByType"],
): string {
  if (accountsByType.length === 0) {
    return "No accounts recorded.";
  }

  return accountsByType
    .map(
      (entry) =>
        `${formatAccountType(entry.accountType)} ${entry.count}`,
    )
    .join(" · ");
}

function hasReportActivity(data: ReportsData): boolean {
  return (
    data.snapshots.recordedGivingTotal > 0 ||
    data.snapshots.nonVoidExpenseTotal > 0 ||
    data.snapshots.openPayablesAmount > 0 ||
    data.snapshots.totalBudgetedAmount > 0 ||
    data.summaries.accounting.journalEntryCount > 0 ||
    data.summaries.organization.memberCount > 0 ||
    data.summaries.organization.vendorCount > 0 ||
    data.summaries.organization.fundCount > 0
  );
}

export function ReportsPageContent({ data }: ReportsPageContentProps) {
  const reportsNav = getNavItemByPathname("/reports");

  if (!reportsNav) {
    throw new Error("Reports navigation item is not configured.");
  }

  return (
    <section aria-labelledby="reports-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="reports-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {reportsNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {reportsNav.description}
        </p>
      </header>

      {!hasReportActivity(data) ? (
        <WorkspaceDataEmpty message="No report-ready activity yet." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshotLabels.map((label) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatSnapshotValue(label, data)}
            </p>
          </article>
        ))}
      </div>

      <section
        aria-labelledby="reports-available-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="reports-available-title"
            className="text-lg font-semibold text-foreground"
          >
            Available Reports / Live Summaries
          </h2>
          <p className="text-sm text-muted-foreground">
            Schema-backed summaries available with the current data model.
          </p>
        </div>

        <ul className="mt-6 space-y-4">
          {data.availableReports.map((report) => (
            <li
              key={report.id}
              className="rounded-lg border border-border p-4 text-sm"
            >
              <p className="font-medium text-foreground">{report.name}</p>
              <p className="mt-1 text-muted-foreground">{report.description}</p>
              {report.id === "giving-summary" ? (
                <p className="mt-2 text-muted-foreground">
                  Recorded transactions:{" "}
                  {data.summaries.giving.recordedTransactionCount} · This month:{" "}
                  {formatCurrency(data.summaries.giving.givingThisMonth)} · YTD:{" "}
                  {formatCurrency(data.summaries.giving.yearToDateGiving)}
                </p>
              ) : null}
              {report.id === "expense-summary" ? (
                <p className="mt-2 text-muted-foreground">
                  Non-void expenses: {data.summaries.expenses.nonVoidCount} ·
                  Total: {formatCurrency(data.summaries.expenses.totalAmount)} ·
                  This month: {data.summaries.expenses.thisMonthCount} (
                  {formatCurrency(data.summaries.expenses.amountThisMonth)})
                </p>
              ) : null}
              {report.id === "payables-summary" ? (
                <p className="mt-2 text-muted-foreground">
                  Non-void bills: {data.summaries.bills.nonVoidCount} · Open:{" "}
                  {data.summaries.bills.openCount} (
                  {formatCurrency(data.summaries.bills.openAmount)}) · Paid:{" "}
                  {data.summaries.bills.paidCount}
                </p>
              ) : null}
              {report.id === "budget-allocation-summary" ? (
                <p className="mt-2 text-muted-foreground">
                  Budgets: {data.summaries.budgets.budgetCount} · With lines:{" "}
                  {data.summaries.budgets.budgetsWithLines} · Total budgeted:{" "}
                  {formatCurrency(data.summaries.budgets.totalBudgetedAmount)}
                </p>
              ) : null}
              {report.id === "accounting-activity-summary" ? (
                <p className="mt-2 text-muted-foreground">
                  Accounts: {data.summaries.accounting.accountCount} (
                  {formatAccountsByType(
                    data.summaries.accounting.accountsByType,
                  )}
                  ) · Open periods: {data.summaries.accounting.openPeriodCount}
                  {data.summaries.accounting.currentPeriodName
                    ? ` · Current period: ${data.summaries.accounting.currentPeriodName}`
                    : ""}{" "}
                  · Journal entries: {data.summaries.accounting.journalEntryCount}{" "}
                  · Posted: {data.summaries.accounting.postedJournalCount} ·
                  Posted debits:{" "}
                  {formatCurrency(data.summaries.accounting.postedDebitTotal)} ·
                  Posted credits:{" "}
                  {formatCurrency(data.summaries.accounting.postedCreditTotal)}
                </p>
              ) : null}
              {report.id === "trial-balance" ? (
                <>
                  <p className="mt-2 text-muted-foreground">
                    As of {formatReportDate(data.financialReports.asOfDate)} ·
                    Balanced:{" "}
                    {data.financialReports.trialBalance.isBalanced ? "Yes" : "No"}
                  </p>
                  <FinancialReportTable
                    caption="Trial balance"
                    headers={["Account", "Type", "Debit", "Credit"]}
                    rows={data.financialReports.trialBalance.rows.map((row) => [
                      `${row.code} · ${row.name}`,
                      formatAccountType(row.accountType),
                      row.debitBalance > 0 ? formatCurrency(row.debitBalance) : "—",
                      row.creditBalance > 0 ? formatCurrency(row.creditBalance) : "—",
                    ])}
                    footer={[
                      "Totals",
                      "",
                      formatCurrency(data.financialReports.trialBalance.totalDebits),
                      formatCurrency(data.financialReports.trialBalance.totalCredits),
                    ]}
                  />
                </>
              ) : null}
              {report.id === "balance-sheet" ? (
                <>
                  <p className="mt-2 text-muted-foreground">
                    As of {formatReportDate(data.financialReports.asOfDate)}
                  </p>
                  <FinancialReportTable
                    caption="Balance sheet"
                    headers={["Section", "Account", "Balance"]}
                    rows={data.financialReports.balanceSheet.sections.flatMap(
                      (section) =>
                        section.rows.map((row) => [
                          formatAccountType(section.accountType),
                          `${row.code} · ${row.name}`,
                          formatCurrency(row.balance),
                        ]),
                    )}
                    footer={[
                      "Totals",
                      `Assets ${formatCurrency(data.financialReports.balanceSheet.totalAssets)} · Liabilities ${formatCurrency(data.financialReports.balanceSheet.totalLiabilities)} · Net assets ${formatCurrency(data.financialReports.balanceSheet.totalNetAssets)}`,
                      formatCurrency(
                        data.financialReports.balanceSheet.totalLiabilitiesAndNetAssets,
                      ),
                    ]}
                  />
                </>
              ) : null}
              {report.id === "income-statement" ? (
                <>
                  <p className="mt-2 text-muted-foreground">
                    Period {formatReportDate(data.financialReports.periodStartDate)} –{" "}
                    {formatReportDate(data.financialReports.periodEndDate)} · Net
                    income:{" "}
                    {formatCurrency(data.financialReports.incomeStatement.netIncome)}
                  </p>
                  <FinancialReportTable
                    caption="Income statement"
                    headers={["Section", "Account", "Amount"]}
                    rows={[
                      ...data.financialReports.incomeStatement.revenue.map((row) => [
                        "Revenue",
                        `${row.code} · ${row.name}`,
                        formatCurrency(row.amount),
                      ]),
                      ...data.financialReports.incomeStatement.expenses.map((row) => [
                        "Expense",
                        `${row.code} · ${row.name}`,
                        formatCurrency(row.amount),
                      ]),
                    ]}
                    footer={[
                      "Totals",
                      `Revenue ${formatCurrency(data.financialReports.incomeStatement.totalRevenue)} · Expenses ${formatCurrency(data.financialReports.incomeStatement.totalExpenses)}`,
                      formatCurrency(data.financialReports.incomeStatement.netIncome),
                    ]}
                  />
                </>
              ) : null}
              {report.id === "fund-balance" ? (
                <>
                  <p className="mt-2 text-muted-foreground">
                    As of {formatReportDate(data.financialReports.asOfDate)} · Total:{" "}
                    {formatCurrency(data.financialReports.fundBalance.totalBalance)}
                  </p>
                  <FinancialReportTable
                    caption="Fund balance"
                    headers={["Fund", "Code", "Balance"]}
                    rows={data.financialReports.fundBalance.rows.map((row) => [
                      row.name,
                      row.code ?? "—",
                      formatCurrency(row.balance),
                    ])}
                    footer={[
                      "Total",
                      "",
                      formatCurrency(data.financialReports.fundBalance.totalBalance),
                    ]}
                  />
                </>
              ) : null}
              {report.id === "budget-vs-actual" ? (
                <>
                  {data.budgetVsActual ? (
                    <>
                      <p className="mt-2 text-muted-foreground">
                        {data.budgetVsActual.budgetName} ·{" "}
                        {formatReportDate(data.budgetVsActual.startDate)} –{" "}
                        {formatReportDate(data.budgetVsActual.endDate)} · Total
                        variance: {formatCurrency(data.budgetVsActual.totalVariance)}
                      </p>
                      <FinancialReportTable
                        caption="Budget vs actual"
                        headers={["Account", "Fund", "Budgeted", "Actual", "Variance"]}
                        rows={data.budgetVsActual.rows.map((row) => [
                          `${row.accountCode} · ${row.accountName}`,
                          row.fundName ?? "—",
                          formatCurrency(row.budgetedAmount),
                          formatCurrency(row.actualAmount),
                          formatCurrency(row.variance),
                        ])}
                        footer={[
                          "Totals",
                          "",
                          formatCurrency(data.budgetVsActual.totalBudgeted),
                          formatCurrency(data.budgetVsActual.totalActual),
                          formatCurrency(data.budgetVsActual.totalVariance),
                        ]}
                      />
                    </>
                  ) : (
                    <p className="mt-2 text-muted-foreground">
                      No active budget with lines covers the current date.
                    </p>
                  )}
                </>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-muted-foreground">
          Members: {data.summaries.organization.memberCount} · Vendors:{" "}
          {data.summaries.organization.vendorCount} · Funds:{" "}
          {data.summaries.organization.fundCount} · Funds with recorded giving:{" "}
          {data.summaries.organization.fundsWithRecordedGiving}
        </p>
      </section>

      {data.unavailableReports.length > 0 ? (
        <section
          aria-labelledby="reports-unavailable-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="reports-unavailable-title"
              className="text-lg font-semibold text-foreground"
            >
              Advanced Reports Not Yet Available
            </h2>
            <p className="text-sm text-muted-foreground">
              The following reports require additional classification or variance
              logic.
            </p>
          </div>

          <ul className="mt-6 space-y-3">
            {data.unavailableReports.map((report) => (
              <li
                key={report.id}
                className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
              >
                <p className="font-medium text-foreground">{report.name}</p>
                <p className="mt-1 text-muted-foreground">
                  Unavailable — {report.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="reports-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="reports-related-workspaces-title"
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

export type { ReportsPageContentProps };
