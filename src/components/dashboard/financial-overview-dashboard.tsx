import Link from "next/link";
import { AlertTriangle, BookOpenCheck, ChartNoAxesCombined, ChevronRight, CircleCheck, FileText, HandCoins, MoreVertical, RefreshCw, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { DashboardKpi } from "@/features/accounting-dashboard/types/dashboard";
import { formatCurrency } from "@/features/accounting-dashboard/lib/formatters";
import type { DashboardData } from "@/lib/data/dashboard-repository";
import type { ExpensesData } from "@/lib/data/expenses-repository";
import type { FundsData } from "@/lib/data/funds-repository";

import { KpiGrid } from "./kpi-grid";
import { FinancialOverviewHeader } from "./financial-overview-header";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

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
      label: "Available by Fund",
      value: (fundsData?.funds ?? []).reduce(
        (total, fund) =>
          total +
          fund.givingTotalAmount -
          fund.expenseAllocationTotal -
          fund.billAllocationTotal,
        0,
      ),
      supportingText: `Across ${fundsData?.funds.length ?? 0} active funds`,
      accent: "violet",
    },
  ];
  const openCompliance = data.complianceItems.filter((item) => item.status === "open");
  const attentionIsEmpty = data.openExceptions.length === 0 && openCompliance.length === 0 && data.openBills.length === 0;
  const notificationCount =
    data.openExceptions.length + openCompliance.length + data.openBills.length;
  const fundRows = (fundsData?.funds ?? []).slice(0, 6).map((fund) => ({
    ...fund,
    balance:
      fund.givingTotalAmount -
      fund.expenseAllocationTotal -
      fund.billAllocationTotal,
  }));
  const maxFundBalance = Math.max(
    ...fundRows.map((fund) => Math.abs(fund.balance)),
    1,
  );
  const recentExpenses = (expensesData?.expenses ?? []).slice(0, 5);
  const insightRecommendations =
    data.closeTasks.length > 0
      ? data.closeTasks.slice(0, 2).map((task) => task.title)
      : [
          data.summary.unreconciledTransactionCount > 0
            ? `Review ${data.summary.unreconciledTransactionCount} unreconciled transactions`
            : "Review current reconciliation status",
          data.openExceptions.length > 0
            ? `Resolve ${data.openExceptions.length} open exceptions`
            : "Prepare the month-end close checklist",
        ];
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

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
        <section aria-labelledby="activity-title" className="dashboard-command-card min-h-[19.5rem] overflow-hidden p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="activity-title" className="text-sm font-semibold tracking-[0.04em] text-[#F7FAFF] uppercase">Giving &amp; Expense Activity</h2>
              <div className="mt-3 flex items-start gap-8 text-xs text-[#AEB9CE]">
                <span className="flex items-start gap-2">
                  <span className="mt-1 size-2.5 rounded-full bg-[#1677FF]" />
                  <span>Giving<br /><span className="text-[#7E8AA8]">(Contributions)</span></span>
                </span>
                <span className="flex items-start gap-2">
                  <span className="mt-1 size-2.5 rounded-full bg-[#DDE5F3]" />
                  <span>Expenses<br /><span className="text-[#7E8AA8]">(Operating)</span></span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div aria-label="Activity range" className="flex overflow-hidden rounded-md border border-white/10 text-[0.68rem] text-[#AEB9CE]">
                {["7D", "30D", "90D", "YTD"].map((range) => (
                  <button
                    key={range}
                    type="button"
                    aria-pressed={range === "30D"}
                    className={`min-w-12 border-r border-white/10 px-3 py-2 last:border-r-0 ${range === "30D" ? "bg-[#0B3577] text-[#F7FAFF] shadow-[inset_0_0_12px_rgb(22_119_255/22%)]" : "bg-[#07111D] hover:bg-white/[0.04]"}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Activity options" className="grid size-8 place-items-center rounded-md text-[#AEB9CE] hover:bg-white/[0.04] hover:text-[#F7FAFF]">
                <MoreVertical aria-hidden className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[2.8rem_minmax(0,1fr)] gap-2 text-[0.62rem] text-[#7E8AA8]">
            <div className="flex h-[11.7rem] flex-col justify-between py-0.5 text-right tabular-nums">
              <span>$125K</span><span>$100K</span><span>$75K</span><span>$50K</span><span>$25K</span><span>$0</span>
            </div>
            <div>
              <svg
                aria-label={`Giving ${formatCurrency(data.summary.givingThisMonth)}; expenses ${formatCurrency(data.summary.expensesThisMonth)}`}
                className="h-[11.7rem] w-full overflow-visible"
                preserveAspectRatio="none"
                role="img"
                viewBox="0 0 620 186"
              >
                <defs>
                  <linearGradient id="giving-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1677FF" stopOpacity=".42" />
                    <stop offset="100%" stopColor="#1677FF" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="expense-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#DDE5F3" stopOpacity=".25" />
                    <stop offset="100%" stopColor="#DDE5F3" stopOpacity=".02" />
                  </linearGradient>
                  <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur result="blur" stdDeviation="3" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {[0, 37, 74, 111, 148, 185].map((y) => (
                  <line key={y} x1="0" x2="620" y1={y} y2={y} stroke="rgba(126,138,168,.16)" strokeDasharray="3 4" />
                ))}
                <path d="M0 186 L0 112 L23 87 L46 65 L69 85 L92 62 L115 75 L138 31 L161 73 L184 97 L207 82 L230 73 L253 80 L276 31 L299 63 L322 82 L345 104 L368 113 L391 100 L414 67 L437 51 L460 12 L483 48 L506 64 L529 66 L552 91 L575 77 L598 85 L620 80 L620 186 Z" fill="url(#giving-area)" />
                <path d="M0 186 L0 166 L23 155 L46 160 L69 143 L92 155 L115 145 L138 126 L161 140 L184 131 L207 126 L230 129 L253 111 L276 90 L299 105 L322 116 L345 130 L368 139 L391 119 L414 109 L437 103 L460 76 L483 106 L506 94 L529 119 L552 132 L575 114 L598 108 L620 82 L620 186 Z" fill="url(#expense-area)" />
                <polyline fill="none" filter="url(#line-glow)" points="0,112 23,87 46,65 69,85 92,62 115,75 138,31 161,73 184,97 207,82 230,73 253,80 276,31 299,63 322,82 345,104 368,113 391,100 414,67 437,51 460,12 483,48 506,64 529,66 552,91 575,77 598,85 620,80" stroke="#1677FF" strokeWidth="1.6" />
                <polyline fill="none" points="0,166 23,155 46,160 69,143 92,155 115,145 138,126 161,140 184,131 207,126 230,129 253,111 276,90 299,105 322,116 345,130 368,139 391,119 414,109 437,103 460,76 483,106 506,94 529,119 552,132 575,114 598,108 620,82" stroke="#DDE5F3" strokeWidth="1.5" />
                {[["0","112"],["46","65"],["92","62"],["138","31"],["184","97"],["230","73"],["276","31"],["322","82"],["368","113"],["414","67"],["460","12"],["506","64"],["552","91"],["598","85"],["620","80"]].map(([x,y]) => <circle key={`g-${x}`} cx={x} cy={y} fill="#1677FF" r="2.8" stroke="#6FB0FF" strokeWidth=".7" />)}
                {[["0","166"],["46","160"],["92","155"],["138","126"],["184","131"],["230","129"],["276","90"],["322","116"],["368","139"],["414","109"],["460","76"],["506","94"],["552","132"],["598","108"],["620","82"]].map(([x,y]) => <circle key={`e-${x}`} cx={x} cy={y} fill="#DDE5F3" r="2.6" stroke="#F7FAFF" strokeWidth=".6" />)}
              </svg>
              <div className="mt-1 flex justify-between border-t border-white/10 pt-2 tabular-nums">
                <span>Jun 29</span><span>Jul 6</span><span>Jul 13</span><span>Jul 20</span><span>Jul 27</span>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="fund-health-title" className="dashboard-command-card min-h-[19.5rem] p-4">
          <div className="flex items-center justify-between">
            <h2 id="fund-health-title" className="text-sm font-semibold tracking-[0.04em] text-[#F7FAFF] uppercase">Fund Health</h2>
            <Link href="/funds" className="text-xs text-[#1677FF]">View all funds</Link>
          </div>
          <div className="mt-5 space-y-3">
            {fundRows.length === 0 ? <WorkspaceDataEmpty message="No funds yet." /> : fundRows.map((fund) => (
              <div key={fund.id} className="grid grid-cols-[6.5rem_minmax(3rem,1fr)_5rem_5.5rem] items-center gap-3 text-xs">
                <p className="truncate text-[#F7FAFF]">{fund.name}</p>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#13C6FF,#1677FF)]" style={{ width: `${Math.max((Math.abs(fund.balance) / maxFundBalance) * 100, 2)}%` }} /></span>
                <span className="text-right text-[#DDE5F3] tabular-nums">{formatCurrency(fund.balance)}</span>
                <span className={`justify-self-end rounded-md border px-2.5 py-1.5 text-[0.64rem] capitalize ${fund.fund_type.toLowerCase() === "unrestricted" ? "border-[#1677FF]/30 text-[#1677FF]" : "border-white/10 text-[#AEB9CE]"}`}>
                  {fund.fund_type}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(29rem,1.2fr)_minmax(18rem,0.9fr)]">
        <section className="dashboard-command-card p-4" aria-labelledby="attention-title">
          <h2 id="attention-title" className="text-sm font-semibold uppercase">Needs Attention</h2>
          <div className="mt-3 space-y-2">
            {attentionIsEmpty ? <WorkspaceDataEmpty message="No items yet." /> : null}
            {data.openExceptions.slice(0, 2).map((item) => <div key={item.id} className="dashboard-row flex items-center gap-2 rounded-md border p-3 text-xs"><AlertTriangle aria-hidden className="size-4 shrink-0 text-[#FFB547]" /><div className="min-w-0"><p className="truncate text-[#F7FAFF]">{item.title}</p><p className="mt-1 text-[#7E8AA8]">{item.severity} · {item.category}</p></div></div>)}
            {openCompliance.slice(0, 2).map((item) => <div key={item.id} className="dashboard-row flex items-center gap-2 rounded-md border p-3 text-xs"><BookOpenCheck aria-hidden className="size-4 shrink-0 text-[#13C6FF]" /><div className="min-w-0"><p className="truncate text-[#F7FAFF]">{item.name}</p><p className="mt-1 text-[#7E8AA8]">{item.due_date ? `Due ${item.due_date}` : "No due date recorded"}</p></div></div>)}
          </div>
        </section>
        <section className="dashboard-command-card overflow-hidden" aria-labelledby="recent-title">
          <div className="flex items-center justify-between px-4 pt-4"><h2 id="recent-title" className="text-sm font-semibold uppercase">Recent Expenses</h2><Link href="/expenses" className="text-xs text-[#1677FF]">View all</Link></div>
          <div className="mt-3 overflow-x-auto">
            {recentExpenses.length === 0 ? <div className="p-4"><WorkspaceDataEmpty message="No recent expenses yet." /></div> : (
              <table className="w-full min-w-[30rem] text-left text-xs">
                <thead className="text-[0.62rem] tracking-[0.06em] text-[#7E8AA8] uppercase"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
                <tbody>{recentExpenses.map((expense) => <tr key={expense.id} className="border-t border-white/[0.055] hover:bg-white/[0.025]"><td className="whitespace-nowrap px-4 py-3 text-[#AEB9CE]">{expense.expense_date}</td><td className="px-3 py-3 text-[#F7FAFF]">{expense.description}</td><td className="px-3 py-3 text-right text-[#F7FAFF] tabular-nums">{formatCurrency(Number(expense.total_amount))}</td><td className="px-3 py-3"><span className="rounded border border-[#7E8AA8]/25 bg-[#7E8AA8]/8 px-2 py-1 text-[#AEB9CE]">{expense.status}</span></td></tr>)}</tbody>
              </table>
            )}
          </div>
        </section>
        <section className="dashboard-command-card dashboard-ai-insight overflow-hidden p-4" aria-labelledby="close-title">
          <div className="relative z-10 flex items-center gap-2">
            <Sparkles aria-hidden className="size-4 text-[#6674FF]" />
            <h2 id="close-title" className="text-xs font-semibold tracking-[0.05em] text-[#F7FAFF] uppercase">
              AI Financial Insight
            </h2>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.58rem] font-medium text-[#AEB9CE]">
              BETA
            </span>
          </div>
          <p className="relative z-10 mt-4 max-w-[18rem] text-[0.7rem] leading-5 text-[#D6DEEB]">
            Giving totals <span className="text-[#13C6FF]">{formatCurrency(data.summary.givingThisMonth)}</span> this month,
            while operating expenses total {formatCurrency(data.summary.expensesThisMonth)}.
            The current net operating position is {formatCurrency(data.summary.netOperatingPosition)}.
          </p>
          <p className="relative z-10 mt-4 text-[0.6rem] font-medium tracking-[0.06em] text-[#1677FF] uppercase">
            Recommendations
          </p>
          <ul className="relative z-10 mt-2 space-y-2">
            {insightRecommendations.map((recommendation) => (
              <li key={recommendation} className="flex items-center gap-2 text-[0.68rem] text-[#D6DEEB]">
                <CircleCheck aria-hidden className="size-3.5 shrink-0 text-[#13C6FF]" />
                <span className="min-w-0 flex-1 truncate">{recommendation}</span>
                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-[#AEB9CE]" />
              </li>
            ))}
          </ul>
          <Button asChild className="relative z-10 mt-4 h-8 w-full border border-[#1677FF]/35 bg-[#0B3577] text-[0.68rem] text-[#6FADFF] shadow-none hover:bg-[#104493]">
            <Link href="/ai-close">
              <ChartNoAxesCombined aria-hidden className="size-3.5" />
              View Full Analysis
            </Link>
          </Button>
        </section>
      </div>

      <section aria-label="Accounting status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open Bills", value: String(data.summary.openBillCount), icon: FileText },
          { label: "Unreconciled Transactions", value: String(data.summary.unreconciledTransactionCount), icon: RefreshCw },
          { label: "Giving This Month", value: formatCurrency(data.summary.givingThisMonth), icon: HandCoins },
          { label: "Net Operating Position", value: formatCurrency(data.summary.netOperatingPosition), icon: TrendingUp },
        ].map((item) => (
          <article key={item.label} className="dashboard-status-strip-item flex min-h-20 items-center gap-3 px-4 py-3">
            <span className="grid size-10 place-items-center rounded-full border border-[#1677FF]/25 text-[#1677FF]"><item.icon aria-hidden className="size-5" /></span>
            <div><p className="brand-label text-[#7E8AA8]">{item.label}</p><p className="mt-1 font-heading text-base text-[#F7FAFF] tabular-nums">{item.value}</p></div>
          </article>
        ))}
      </section>
    </section>
  );
}
