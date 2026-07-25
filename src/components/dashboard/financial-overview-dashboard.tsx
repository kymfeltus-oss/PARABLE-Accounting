import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  BookOpenCheck,
  ChevronRight,
  CircleCheck,
  FileText,
  HandCoins,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { DashboardKpi } from "@/features/accounting-dashboard/types/dashboard";
import { formatCurrency } from "@/features/accounting-dashboard/lib/formatters";
import type { DashboardData } from "@/lib/data/dashboard-repository";
import type { ExpensesData } from "@/lib/data/expenses-repository";
import type { FundsData } from "@/lib/data/funds-repository";

import { KpiGrid } from "./kpi-grid";
import { FinancialOverviewHeader } from "./financial-overview-header";

export function FinancialOverviewDashboard({
  data,
  expensesData,
  fundsData,
}: {
  data: DashboardData;
  expensesData?: ExpensesData;
  fundsData?: FundsData;
}) {
  const kpis: DashboardKpi[] = [
    { id: "cash", label: "Cash Position", value: data.summary.totalCash, supportingText: "Current cash position", accent: "blue" },
    { id: "giving", label: "Giving This Month", value: data.summary.givingThisMonth, supportingText: "Recorded contributions", accent: "cyan" },
    { id: "expenses", label: "Operating Expenses", value: data.summary.expensesThisMonth, supportingText: "Current month spending", accent: "amber" },
    {
      id: "funds",
      label: "Fund Equity (Ledger)",
      value: (fundsData?.funds ?? []).reduce(
        (total, fund) => total + fund.ledgerBalance,
        0,
      ),
      supportingText: `Across ${fundsData?.funds.length ?? 0} funds from posted ledger`,
      accent: "violet",
    },
  ];
  const openCompliance = data.complianceItems.filter((item) => item.status === "open");
  const attentionIsEmpty = data.openExceptions.length === 0 && openCompliance.length === 0 && data.openBills.length === 0;
  const notificationCount =
    data.openExceptions.length + openCompliance.length + data.openBills.length;
  const fundRows = (fundsData?.funds ?? []).slice(0, 6).map((fund) => ({
    ...fund,
    balance: fund.ledgerBalance,
  }));
  const maxFundBalance = Math.max(
    ...fundRows.map((fund) => Math.abs(fund.balance)),
    1,
  );
  const recentExpenses = (expensesData?.expenses ?? []).slice(0, 5);
  const insightRecommendations = (
    data.closeTasks.length > 0
      ? data.closeTasks.slice(0, 2).map((task) => ({
          label: task.title,
          href: "/accounting" as const,
        }))
      : [
          data.summary.unreconciledTransactionCount > 0
            ? {
                label: `Review ${data.summary.unreconciledTransactionCount} unreconciled transactions`,
                href: "/banking" as const,
              }
            : {
                label: "Review current reconciliation status",
                href: "/banking" as const,
              },
          data.openExceptions.length > 0
            ? {
                label: `Resolve ${data.openExceptions.length} open exceptions`,
                href: "/exceptions" as const,
              }
            : {
                label: "Prepare the month-end close checklist",
                href: "/accounting" as const,
              },
        ]
  );
  const vendorOptions = Array.from(
    new Map(
      (expensesData?.expenses ?? [])
        .filter((expense) => expense.vendor_id && expense.vendorName)
        .map((expense) => [
          expense.vendor_id as string,
          { id: expense.vendor_id as string, name: expense.vendorName as string },
        ]),
    ).values(),
  );

  return (
    <section aria-label="Financial Overview" className="financial-overview mx-auto w-full max-w-[96rem] space-y-3">
      <FinancialOverviewHeader
        notificationCount={notificationCount}
        vendorOptions={vendorOptions}
      />

      <KpiGrid kpis={kpis} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <section
          aria-labelledby="activity-title"
          className="dashboard-command-card min-h-[19.5rem] min-w-0 overflow-hidden p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2
                id="activity-title"
                className="text-sm font-semibold tracking-[0.04em] text-[#F7FAFF] uppercase"
              >
                Giving &amp; Expense Activity
              </h2>
              <p className="mt-2 text-xs text-[#AEB9CE]">
                Live totals for the current month. Open Giving or Expenses for
                the full registers.
              </p>
            </div>
            <p className="shrink-0 rounded-md border border-white/10 bg-[#07111D] px-3 py-2 text-[0.68rem] text-[#AEB9CE]">
              This month
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href="/giving"
              className="rounded-lg border border-white/10 bg-[#07111D] p-4 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]/50"
            >
              <p className="brand-label text-[#7E8AA8]">Giving this month</p>
              <p className="mt-2 font-heading text-2xl text-[#F7FAFF] tabular-nums">
                {formatCurrency(data.summary.givingThisMonth)}
              </p>
              <p className="mt-2 text-xs text-[#1677FF]">Open giving →</p>
            </Link>
            <Link
              href="/expenses"
              className="rounded-lg border border-white/10 bg-[#07111D] p-4 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]/50"
            >
              <p className="brand-label text-[#7E8AA8]">Expenses this month</p>
              <p className="mt-2 font-heading text-2xl text-[#F7FAFF] tabular-nums">
                {formatCurrency(data.summary.expensesThisMonth)}
              </p>
              <p className="mt-2 text-xs text-[#1677FF]">Open expenses →</p>
            </Link>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 px-4 py-3">
            <p className="brand-label text-[#7E8AA8]">Net operating position</p>
            <p className="mt-1 font-heading text-xl text-[#F7FAFF] tabular-nums">
              {formatCurrency(data.summary.netOperatingPosition)}
            </p>
          </div>
        </section>

        <section aria-labelledby="fund-health-title" className="dashboard-command-card min-h-[19.5rem] p-4">
          <div className="flex items-center justify-between">
            <h2 id="fund-health-title" className="text-sm font-semibold tracking-[0.04em] text-[#F7FAFF] uppercase">Fund Equity</h2>
            <Link href="/funds" className="text-xs text-[#1677FF]">View all funds</Link>
          </div>
          <div className="mt-5 space-y-3">
            {fundRows.length === 0 ? <WorkspaceDataEmpty message="No funds yet." /> : fundRows.map((fund) => (
              <div key={fund.id} className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center justify-between gap-2 sm:contents">
                  <p className="truncate text-[#F7FAFF]">{fund.name}</p>
                  <span className="shrink-0 text-right text-[#DDE5F3] tabular-nums sm:order-3">{formatCurrency(fund.balance)}</span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] sm:order-2"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#13C6FF,#1677FF)]" style={{ width: `${Math.max((Math.abs(fund.balance) / maxFundBalance) * 100, 2)}%` }} /></span>
                <span className={`w-fit rounded-md border px-2.5 py-1.5 text-[0.64rem] capitalize sm:order-4 sm:justify-self-end ${fund.fund_type.toLowerCase() === "unrestricted" ? "border-[#1677FF]/30 text-[#1677FF]" : "border-white/10 text-[#AEB9CE]"}`}>
                  {fund.fund_type}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <section className="dashboard-command-card min-w-0 p-4" aria-labelledby="attention-title">
          <h2 id="attention-title" className="text-sm font-semibold uppercase">Needs Attention</h2>
          <div className="mt-3 space-y-2">
            {attentionIsEmpty ? <WorkspaceDataEmpty message="No items yet." /> : null}
            {data.openExceptions.slice(0, 2).map((item) => <div key={item.id} className="dashboard-row flex items-center gap-2 rounded-md border p-3 text-xs"><AlertTriangle aria-hidden className="size-4 shrink-0 text-[#FFB547]" /><div className="min-w-0"><p className="truncate text-[#F7FAFF]">{item.title}</p><p className="mt-1 text-[#7E8AA8]">{item.severity} · {item.category}</p></div></div>)}
            {openCompliance.slice(0, 2).map((item) => <div key={item.id} className="dashboard-row flex items-center gap-2 rounded-md border p-3 text-xs"><BookOpenCheck aria-hidden className="size-4 shrink-0 text-[#13C6FF]" /><div className="min-w-0"><p className="truncate text-[#F7FAFF]">{item.name}</p><p className="mt-1 text-[#7E8AA8]">{item.due_date ? `Due ${item.due_date}` : "No due date recorded"}</p></div></div>)}
            {data.openBills.slice(0, 2).map((bill) => (
              <Link
                key={bill.id}
                href="/bills"
                className="dashboard-row flex items-center gap-2 rounded-md border p-3 text-xs transition hover:bg-white/[0.04]"
              >
                <FileText aria-hidden className="size-4 shrink-0 text-[#1677FF]" />
                <div className="min-w-0">
                  <p className="truncate text-[#F7FAFF]">
                    {bill.bill_number ?? bill.description ?? "Open bill"} ·{" "}
                    {formatCurrency(Number(bill.total_amount))}
                  </p>
                  <p className="mt-1 text-[#7E8AA8]">
                    {bill.due_date ? `Due ${bill.due_date}` : "No due date recorded"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="dashboard-command-card min-w-0 overflow-hidden" aria-labelledby="recent-title">
          <div className="flex items-center justify-between gap-2 px-4 pt-4"><h2 id="recent-title" className="text-sm font-semibold uppercase">Recent Expenses</h2><Link href="/expenses" className="shrink-0 text-xs text-[#1677FF]">View all</Link></div>
          <div className="mt-3 overflow-x-auto">
            {recentExpenses.length === 0 ? <div className="p-4"><WorkspaceDataEmpty message="No recent expenses yet." /></div> : (
              <table className="w-full min-w-[20rem] text-left text-xs sm:min-w-[30rem]">
                <thead className="text-[0.62rem] tracking-[0.06em] text-[#7E8AA8] uppercase"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
                <tbody>{recentExpenses.map((expense) => <tr key={expense.id} className="border-t border-white/[0.055] hover:bg-white/[0.025]"><td className="whitespace-nowrap px-4 py-3 text-[#AEB9CE]">{expense.expense_date}</td><td className="max-w-[10rem] truncate px-3 py-3 text-[#F7FAFF] sm:max-w-none">{expense.description}</td><td className="px-3 py-3 text-right text-[#F7FAFF] tabular-nums">{formatCurrency(Number(expense.total_amount))}</td><td className="px-3 py-3"><span className="rounded border border-[#7E8AA8]/25 bg-[#7E8AA8]/8 px-2 py-1 text-[#AEB9CE]">{expense.status}</span></td></tr>)}</tbody>
              </table>
            )}
          </div>
        </section>
        <section
          className="dashboard-command-card overflow-hidden p-4"
          aria-labelledby="close-title"
        >
          <div className="flex items-center gap-2">
            <BookOpen aria-hidden className="size-4 text-[#6674FF]" />
            <h2
              id="close-title"
              className="text-xs font-semibold tracking-[0.05em] text-[#F7FAFF] uppercase"
            >
              Month-end focus
            </h2>
          </div>
          <p className="mt-4 max-w-[18rem] text-[0.7rem] leading-5 text-[#D6DEEB]">
            Giving totals{" "}
            <span className="text-[#13C6FF]">
              {formatCurrency(data.summary.givingThisMonth)}
            </span>{" "}
            this month, while operating expenses total{" "}
            {formatCurrency(data.summary.expensesThisMonth)}. The current net
            operating position is{" "}
            {formatCurrency(data.summary.netOperatingPosition)}.
          </p>
          <p className="mt-4 text-[0.6rem] font-medium tracking-[0.06em] text-[#1677FF] uppercase">
            Next steps
          </p>
          <ul className="mt-2 space-y-2">
            {insightRecommendations.map((recommendation) => (
              <li key={`${recommendation.href}-${recommendation.label}`}>
                <Link
                  href={recommendation.href}
                  className="flex items-center gap-2 text-[0.68rem] text-[#D6DEEB] transition hover:text-white"
                >
                  <CircleCheck
                    aria-hidden
                    className="size-3.5 shrink-0 text-[#13C6FF]"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {recommendation.label}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 shrink-0 text-[#AEB9CE]"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <Button
            asChild
            className="mt-4 h-8 w-full border border-[#1677FF]/35 bg-[#0B3577] text-[0.68rem] text-[#6FADFF] shadow-none hover:bg-[#104493]"
          >
            <Link href="/accounting">
              <BookOpen aria-hidden className="size-3.5" />
              Open accounting
            </Link>
          </Button>
        </section>
      </div>

      <section aria-label="Accounting status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Open Bills",
            value: String(data.summary.openBillCount),
            icon: FileText,
            href: "/bills",
          },
          {
            label: "Unreconciled Transactions",
            value: String(data.summary.unreconciledTransactionCount),
            icon: RefreshCw,
            href: "/banking",
          },
          {
            label: "Giving This Month",
            value: formatCurrency(data.summary.givingThisMonth),
            icon: HandCoins,
            href: "/giving",
          },
          {
            label: "Net Operating Position",
            value: formatCurrency(data.summary.netOperatingPosition),
            icon: TrendingUp,
            href: "/reports",
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="dashboard-status-strip-item flex min-h-20 items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]/50"
          >
            <span className="grid size-10 place-items-center rounded-full border border-[#1677FF]/25 text-[#1677FF]">
              <item.icon aria-hidden className="size-5" />
            </span>
            <div>
              <p className="brand-label text-[#7E8AA8]">{item.label}</p>
              <p className="mt-1 font-heading text-base text-[#F7FAFF] tabular-nums">
                {item.value}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </section>
  );
}
