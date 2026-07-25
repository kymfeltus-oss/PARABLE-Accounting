"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Archive,
  FileText,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { ComplianceFrameworkTable } from "@/components/compliance/compliance-framework-table";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { ComplianceData } from "@/lib/data/compliance-repository";

const summaryLabels = [
  "Total Compliance Items",
  "Open Items",
  "Completed Items",
  "Overdue Open Items",
] as const;

const statusFilters = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "completed", label: "Completed" },
  { id: "not_applicable", label: "Not Applicable" },
] as const;

type StatusFilterId = (typeof statusFilters)[number]["id"];

const navigationLinks = [
  {
    id: "ai-close",
    label: "Period Close",
    href: "/ai-close",
    description: "Review close sessions and validation tasks",
    icon: Sparkles,
  },
  {
    id: "exceptions",
    label: "Exceptions",
    href: "/exceptions",
    description: "Inspect compliance-related exceptions",
    icon: TriangleAlert,
  },
  {
    id: "audit-vault",
    label: "Audit Vault",
    href: "/audit-vault",
    description: "Open audit and filing document records",
    icon: Archive,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Review report-ready compliance summaries",
    icon: FileText,
  },
] as const;

type CompliancePageContentProps = {
  data: ComplianceData;
};

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: ComplianceData,
): string {
  switch (label) {
    case "Total Compliance Items":
      return String(data.counts.totalItems);
    case "Open Items":
      return String(data.counts.openItems);
    case "Completed Items":
      return String(data.counts.completedItems);
    case "Overdue Open Items":
      return String(data.counts.overdueOpenItems);
    default:
      return "0";
  }
}

function hasComplianceActivity(data: ComplianceData): boolean {
  return data.items.length > 0;
}

export function CompliancePageContent({ data }: CompliancePageContentProps) {
  const complianceNav = getNavItemByPathname("/compliance");
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("all");
  const [itemSearch, setItemSearch] = useState("");

  if (!complianceNav) {
    throw new Error("Compliance navigation item is not configured.");
  }

  const filteredItems = useMemo(() => {
    const normalizedSearch = itemSearch.trim().toLowerCase();

    return data.items.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.name,
        item.description ?? "",
        item.category,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data.items, itemSearch, statusFilter]);

  return (
    <section aria-labelledby="compliance-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="compliance-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {complianceNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {complianceNav.description}
        </p>
      </header>

      {!hasComplianceActivity(data) ? (
        <WorkspaceDataEmpty message="No compliance items yet." />
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
        External filing integrations and automated compliance scoring are
        unavailable until filing connectors and control frameworks are
        implemented.
      </p>

      <section
        aria-labelledby="compliance-categories-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="compliance-categories-title"
            className="text-lg font-semibold text-foreground"
          >
            Compliance Categories
          </h2>
          <p className="text-sm text-muted-foreground">
            Live item counts grouped by schema-backed compliance categories.
          </p>
        </div>

        <div className="mt-6">
          {data.categories.length === 0 ? (
            <WorkspaceDataEmpty message="No compliance categories yet." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.categories.map((category) => (
                <li
                  key={category.category}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {formatCategory(category.category)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {category.itemCount} item{category.itemCount === 1 ? "" : "s"}{" "}
                    · {category.openCount} open · {category.completedCount}{" "}
                    completed · {category.notApplicableCount} not applicable
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="compliance-items-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="compliance-items-title"
            className="text-lg font-semibold text-foreground"
          >
            Compliance Items
          </h2>
          <p className="text-sm text-muted-foreground">
            Audit and tax compliance checkpoints from live organization records.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter.id}
              aria-pressed={statusFilter === filter.id}
              size="sm"
              type="button"
              variant={statusFilter === filter.id ? "default" : "outline"}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-foreground">
            Search items
            <input
              className="mt-2 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Search by name, category, or description"
              type="search"
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6">
          {data.items.length === 0 ? (
            <WorkspaceDataEmpty message="No compliance items yet." />
          ) : filteredItems.length === 0 ? (
            <WorkspaceDataEmpty message="No compliance items match the current filter." />
          ) : (
            <ComplianceFrameworkTable items={filteredItems} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="compliance-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="compliance-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected compliance and review areas.
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

export type { CompliancePageContentProps };
