import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  FileText,
  HandCoins,
  Landmark,
  PieChart,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { DashboardData } from "@/lib/data/dashboard-repository";

const kpiLabels = [
  "Total Cash",
  "Giving This Month",
  "Expenses This Month",
  "Net Operating Position",
  "Open Bills",
  "Unreconciled Transactions",
] as const;

const kpiIcons = {
  "Total Cash": Landmark,
  "Giving This Month": HandCoins,
  "Expenses This Month": PieChart,
  "Net Operating Position": TrendingUp,
  "Open Bills": FileText,
  "Unreconciled Transactions": RefreshCw,
} as const;

const quickActions = [
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    description: "Review recorded gifts and batches",
    icon: HandCoins,
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/transactions",
    description: "Inspect bank activity and matches",
    icon: ArrowLeftRight,
  },
  {
    id: "bills",
    label: "Bills",
    href: "/bills",
    description: "Open payables needing attention",
    icon: FileText,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/expenses",
    description: "Track ministry spending requests",
    icon: Receipt,
  },
] as const;

type DashboardPageContentProps = {
  data: DashboardData;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatKpiValue(
  label: (typeof kpiLabels)[number],
  summary: DashboardData["summary"],
): string {
  switch (label) {
    case "Total Cash":
      return summary.totalCash === null
        ? "Unavailable"
        : formatCurrency(summary.totalCash);
    case "Giving This Month":
      return formatCurrency(summary.givingThisMonth);
    case "Expenses This Month":
      return formatCurrency(summary.expensesThisMonth);
    case "Net Operating Position":
      return formatCurrency(summary.netOperatingPosition);
    case "Open Bills":
      return String(summary.openBillCount);
    case "Unreconciled Transactions":
      return String(summary.unreconciledTransactionCount);
    default:
      return "Unavailable";
  }
}

function hasFinancialActivity(data: DashboardData): boolean {
  const { summary } = data;

  return (
    data.openExceptions.length > 0 ||
    data.complianceItems.length > 0 ||
    data.openBills.length > 0 ||
    data.closeTasks.length > 0 ||
    data.recentActivity.length > 0 ||
    summary.givingThisMonth > 0 ||
    summary.expensesThisMonth > 0 ||
    summary.openBillCount > 0 ||
    summary.unreconciledTransactionCount > 0
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DashboardPageContent({ data }: DashboardPageContentProps) {
  const dashboardNav = getNavItemByPathname("/dashboard");

  if (!dashboardNav) {
    throw new Error("Dashboard navigation item is not configured.");
  }

  const openComplianceItems = data.complianceItems.filter(
    (item) => item.status === "open",
  );

  return (
    <section
      aria-labelledby="dashboard-title"
      className="dashboard-overview space-y-5"
    >
      <header className="dashboard-overview__heading space-y-1.5">
        <h1
          id="dashboard-title"
          className="text-3xl font-semibold tracking-[-0.035em] text-foreground lg:text-4xl"
        >
          {dashboardNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground lg:text-base">
          {dashboardNav.description}
        </p>
      </header>

      {!hasFinancialActivity(data) ? (
        <WorkspaceDataEmpty message="No financial activity yet." />
      ) : null}

      <div className="dashboard-kpi-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiLabels.slice(0, 4).map((label) => {
          const Icon = kpiIcons[label];

          return (
            <article
              key={label}
              className="dashboard-card dashboard-kpi relative overflow-hidden rounded-lg border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-start gap-3.5">
                <span className="dashboard-kpi__icon" aria-hidden>
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-foreground tabular-nums">
                    {formatKpiValue(label, data.summary)}
                  </p>
                </div>
              </div>
              <div aria-hidden className="dashboard-kpi__sparkline" />
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(19rem,0.8fr)]">
        <section
          aria-labelledby="dashboard-attention-title"
          className="dashboard-card rounded-lg border border-border bg-card p-5 text-card-foreground"
        >
          <div className="space-y-1">
            <h2
              id="dashboard-attention-title"
              className="text-lg font-semibold text-foreground"
            >
              Attention
            </h2>
            <p className="text-sm text-muted-foreground">
              Items that may need review before month-end close.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Open Exceptions
              </h3>
              {data.openExceptions.length === 0 ? (
                <WorkspaceDataEmpty message="No items yet." />
              ) : (
                <ul className="space-y-3">
                  {data.openExceptions.map((exception) => (
                    <li
                      key={exception.id}
                      className="dashboard-row rounded-md border border-border p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">
                        {exception.title}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {exception.severity} · {exception.category}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Separator className="lg:hidden" />
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Compliance Deadlines
              </h3>
              {openComplianceItems.length === 0 ? (
                <WorkspaceDataEmpty message="No items yet." />
              ) : (
                <ul className="space-y-3">
                  {openComplianceItems.map((item) => (
                    <li
                      key={item.id}
                      className="dashboard-row rounded-md border border-border p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="mt-1 text-muted-foreground">
                        {item.due_date
                          ? `Due ${item.due_date}`
                          : "No due date recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Separator className="lg:hidden" />
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Bills Requiring Attention
              </h3>
              {data.openBills.length === 0 ? (
                <WorkspaceDataEmpty message="No items yet." />
              ) : (
                <ul className="space-y-3">
                  {data.openBills.map((bill) => (
                    <li
                      key={bill.id}
                      className="dashboard-row rounded-md border border-border p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">
                        {bill.bill_number ?? bill.description ?? "Bill"}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {formatCurrency(Number(bill.total_amount))} ·{" "}
                        {bill.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Separator className="lg:hidden" />
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          <section
            aria-labelledby="dashboard-ai-close-title"
            className="dashboard-card dashboard-ai-card relative overflow-hidden rounded-lg border border-border bg-card p-5 text-card-foreground"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles aria-hidden className="size-4 text-primary" />
                <h2
                  id="dashboard-ai-close-title"
                  className="text-lg font-semibold text-foreground"
                >
                  AI Close
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Month-end readiness from the close checklist.
              </p>
            </div>

            <div className="mt-6">
              {data.closeTasks.length === 0 ? (
                <WorkspaceDataEmpty message="No close tasks yet." />
              ) : (
                <ul className="space-y-3">
                  {data.closeTasks.map((task) => (
                    <li
                      key={task.id}
                      className="dashboard-row rounded-md border border-border p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="mt-1 text-muted-foreground">{task.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5">
              <Button asChild className="w-full" variant="outline">
                <Link href="/ai-close">
                  Open AI Close workspace
                  <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              </Button>
            </div>
          </section>

          <section
            aria-labelledby="dashboard-quick-actions-title"
            className="dashboard-card rounded-lg border border-border bg-card p-5 text-card-foreground"
          >
            <div className="space-y-1">
              <h2
                id="dashboard-quick-actions-title"
                className="text-lg font-semibold text-foreground"
              >
                Quick Actions
              </h2>
              <p className="text-sm text-muted-foreground">
                Jump to core ministry accounting workspaces.
              </p>
            </div>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {quickActions.map((action) => (
                <li key={action.id}>
                  <Button
                    asChild
                    className="dashboard-action h-auto w-full justify-start rounded-md px-3 py-3"
                    variant="outline"
                  >
                    <Link href={action.href}>
                      <action.icon aria-hidden className="size-4" />
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="font-medium">{action.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {action.description}
                        </span>
                      </span>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="dashboard-recent-activity-title"
        className="dashboard-card rounded-lg border border-border bg-card p-5 text-card-foreground"
      >
        <div className="space-y-1">
          <h2
            id="dashboard-recent-activity-title"
            className="text-lg font-semibold text-foreground"
          >
            Recent Activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest operational events across giving, payables, and banking.
          </p>
        </div>

        <div className="mt-5">
          {data.recentActivity.length === 0 ? (
            <WorkspaceDataEmpty message="No recent activity yet." />
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {data.recentActivity.map((event) => (
                <li
                  key={event.id}
                  className="dashboard-row rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {event.description ?? event.event_type}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {formatDate(event.occurred_at)} · {event.source_type}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="dashboard-status-grid grid gap-3 sm:grid-cols-2">
        {kpiLabels.slice(4).map((label) => {
          const Icon = kpiIcons[label];

          return (
            <article
              key={label}
              className="dashboard-card dashboard-status-card flex min-h-20 items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground"
            >
              <span className="dashboard-status-card__icon" aria-hidden>
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
                  {label}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.025em] text-foreground tabular-nums">
                  {formatKpiValue(label, data.summary)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export type { DashboardPageContentProps };
