import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  Landmark,
  Receipt,
} from "lucide-react";

import { CreateVendorForm } from "@/components/vendors/create-vendor-form";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { VendorRecord, VendorsData } from "@/lib/data/vendors-repository";

const summaryLabels = [
  "Total Vendors",
  "Active Vendors",
  "Vendors With Bills",
  "Vendors With Expenses",
] as const;

const navigationLinks = [
  {
    id: "bills",
    label: "Bills",
    href: "/bills",
    description: "Review vendor payables awaiting payment",
    icon: FileText,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/expenses",
    description: "Inspect expense records by vendor",
    icon: Receipt,
  },
  {
    id: "banking",
    label: "Banking",
    href: "/banking",
    description: "Review cash accounts used for vendor payments",
    icon: Landmark,
  },
] as const;

type VendorsPageContentProps = {
  data: VendorsData;
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

function formatTaxIdPresence(hasTaxIdOnFile: boolean): string {
  return hasTaxIdOnFile ? "Tax ID on file" : "No tax ID on file";
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: VendorsData,
): string {
  switch (label) {
    case "Total Vendors":
      return String(data.counts.total);
    case "Active Vendors":
      return String(data.counts.active);
    case "Vendors With Bills":
      return String(data.counts.withBills);
    case "Vendors With Expenses":
      return String(data.counts.withExpenses);
    default:
      return "0";
  }
}

function formatFinancialSummary(vendor: VendorRecord): string {
  const parts: string[] = [];

  if (vendor.billCount > 0) {
    parts.push(
      `${vendor.billCount} bill${vendor.billCount === 1 ? "" : "s"} (${formatCurrency(vendor.totalBilledAmount)})`,
    );
  }

  if (vendor.openBillCount > 0) {
    parts.push(
      `${vendor.openBillCount} open (${formatCurrency(vendor.openBillAmount)})`,
    );
  }

  if (vendor.expenseCount > 0) {
    parts.push(
      `${vendor.expenseCount} expense${vendor.expenseCount === 1 ? "" : "s"} (${formatCurrency(vendor.totalExpenseAmount)})`,
    );
  }

  if (parts.length === 0) {
    return "No related bills or expenses yet.";
  }

  return parts.join(" · ");
}

function hasVendorActivity(data: VendorsData): boolean {
  return data.vendors.length > 0;
}

export function VendorsPageContent({ data }: VendorsPageContentProps) {
  const vendorsNav = getNavItemByPathname("/vendors");

  if (!vendorsNav) {
    throw new Error("Vendors navigation item is not configured.");
  }

  const recentVendors = [...data.vendors]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )
    .slice(0, 10);

  return (
    <section aria-labelledby="vendors-title" className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1
              id="vendors-title"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {vendorsNav.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {vendorsNav.description}
            </p>
          </div>
          <CreateVendorForm />
        </div>
      </header>

      {!hasVendorActivity(data) ? (
        <WorkspaceDataEmpty message="No vendors yet." />
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="vendors-directory-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="vendors-directory-title"
              className="text-lg font-semibold text-foreground"
            >
              Vendor Directory
            </h2>
            <p className="text-sm text-muted-foreground">
              Vendor profiles with contact details and related activity.
            </p>
          </div>

          <div className="mt-6">
            {data.vendors.length === 0 ? (
              <WorkspaceDataEmpty message="No vendors yet." />
            ) : (
              <ul className="space-y-3">
                {recentVendors.map((vendor) => (
                  <li
                    key={vendor.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">{vendor.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {vendor.email ?? "No email recorded"} ·{" "}
                      {vendor.phone ?? "No phone recorded"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {vendor.status} · Added {formatDate(vendor.created_at)} ·{" "}
                      {formatTaxIdPresence(vendor.hasTaxIdOnFile)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {vendor.billCount} bill{vendor.billCount === 1 ? "" : "s"}{" "}
                      · {vendor.expenseCount} expense
                      {vendor.expenseCount === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="vendors-financial-title"
          className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
        >
          <div className="space-y-1">
            <h2
              id="vendors-financial-title"
              className="text-lg font-semibold text-foreground"
            >
              Vendor Activity
            </h2>
            <p className="text-sm text-muted-foreground">
              Related bill and expense totals by vendor.
            </p>
          </div>

          <div className="mt-6">
            {data.vendors.length === 0 ? (
              <WorkspaceDataEmpty message="No vendor activity yet." />
            ) : (
              <ul className="space-y-3">
                {recentVendors
                  .filter(
                    (vendor) =>
                      vendor.billCount > 0 || vendor.expenseCount > 0,
                  )
                  .map((vendor) => (
                    <li
                      key={vendor.id}
                      className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                    >
                      <p className="font-medium text-foreground">{vendor.name}</p>
                      <p className="mt-2 text-muted-foreground">
                        {formatFinancialSummary(vendor)}
                      </p>
                    </li>
                  ))}
                {recentVendors.every(
                  (vendor) =>
                    vendor.billCount === 0 && vendor.expenseCount === 0,
                ) ? (
                  <WorkspaceDataEmpty message="No related bills or expenses yet." />
                ) : null}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section
        aria-labelledby="vendors-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="vendors-related-workspaces-title"
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

export type { VendorsPageContentProps };
