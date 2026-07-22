import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Landmark,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { BillRecord, BillsData } from "@/lib/data/bills-repository";

const summaryLabels = [
  "Total Bills",
  "Open Bills",
  "Paid Bills",
  "Overdue Bills",
] as const;

const navigationLinks = [
  {
    id: "vendors",
    label: "Vendors",
    href: "/vendors",
    description: "Review vendor profiles and payee details",
    icon: Building2,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/expenses",
    description: "Inspect expense records linked to payables",
    icon: Receipt,
  },
  {
    id: "banking",
    label: "Banking",
    href: "/banking",
    description: "Review cash accounts used for bill payments",
    icon: Landmark,
  },
] as const;

type BillsPageContentProps = {
  data: BillsData;
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

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdueBill(bill: BillRecord): boolean {
  if (bill.status !== "draft" && bill.status !== "open") {
    return false;
  }

  if (!bill.due_date) {
    return false;
  }

  return bill.due_date < getTodayDateString();
}

function formatBillReference(bill: BillRecord): string {
  if (bill.bill_number) {
    return bill.bill_number;
  }

  if (bill.description) {
    return bill.description;
  }

  return "No reference recorded";
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: BillsData,
): string {
  switch (label) {
    case "Total Bills":
      return String(data.counts.total);
    case "Open Bills":
      return String(data.counts.open);
    case "Paid Bills":
      return String(data.counts.paid);
    case "Overdue Bills":
      return String(data.counts.overdue);
    default:
      return "0";
  }
}

function hasBillActivity(data: BillsData): boolean {
  return data.bills.length > 0;
}

export function BillsPageContent({ data }: BillsPageContentProps) {
  const billsNav = getNavItemByPathname("/bills");

  if (!billsNav) {
    throw new Error("Bills navigation item is not configured.");
  }

  const activeBills = data.bills.filter((bill) => bill.status !== "void");
  const overdueBills = activeBills.filter((bill) => isOverdueBill(bill));
  const recentBills = activeBills.slice(0, 10);

  return (
    <section aria-labelledby="bills-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="bills-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {billsNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {billsNav.description}
        </p>
      </header>

      {!hasBillActivity(data) ? (
        <WorkspaceDataEmpty message="No bills yet." />
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

      {data.counts.open > 0 ? (
        <p className="text-sm text-muted-foreground">
          Open payables total: {formatCurrency(data.summary.openAmount)}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="bills-list-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="bills-list-title"
              className="text-lg font-semibold text-foreground"
            >
              Bills
            </h2>
            <p className="text-sm text-muted-foreground">
              Vendor payables with bill dates, due dates, and amounts.
            </p>
          </div>

          <div className="mt-6">
            {activeBills.length === 0 ? (
              <WorkspaceDataEmpty message="No bills yet." />
            ) : (
              <ul className="space-y-3">
                {recentBills.map((bill) => (
                  <li
                    key={bill.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {bill.vendorName ?? "Unknown vendor"} ·{" "}
                      {formatBillReference(bill)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Bill date {formatDate(bill.bill_date)} · Due{" "}
                      {bill.due_date
                        ? formatDate(bill.due_date)
                        : "No due date recorded"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatCurrency(Number(bill.total_amount))} · {bill.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="bills-attention-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="bills-attention-title"
              className="text-lg font-semibold text-foreground"
            >
              Needs Attention
            </h2>
            <p className="text-sm text-muted-foreground">
              Open bills past their due date.
            </p>
          </div>

          <div className="mt-6">
            {overdueBills.length === 0 ? (
              <WorkspaceDataEmpty message="No overdue bills." />
            ) : (
              <ul className="space-y-3">
                {overdueBills.map((bill) => (
                  <li
                    key={bill.id}
                    className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {bill.vendorName ?? "Unknown vendor"}
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      {formatBillReference(bill)} · Due{" "}
                      {bill.due_date ? formatDate(bill.due_date) : "Unknown"} ·{" "}
                      {formatCurrency(Number(bill.total_amount))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="bills-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="bills-related-workspaces-title"
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

export type { BillsPageContentProps };
