"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Landmark,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ExceptionItemsTable } from "@/components/exceptions/exception-items-table";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { ExceptionsData } from "@/lib/data/exceptions-repository";

const summaryLabels = [
  "Total Exceptions",
  "Open Exceptions",
  "Resolved Exceptions",
  "High Severity Exceptions",
] as const;

const statusFilters = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "dismissed", label: "Dismissed" },
] as const;

type StatusFilterId = (typeof statusFilters)[number]["id"];

const navigationLinks = [
  {
    id: "banking",
    label: "Banking",
    href: "/banking",
    description: "Review bank transaction matching activity",
    icon: Landmark,
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/transactions",
    description: "Inspect transaction match status",
    icon: BookOpen,
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/compliance",
    description: "Review compliance-related exceptions",
    icon: ShieldCheck,
  },
  {
    id: "ai-close",
    label: "Period Close",
    href: "/ai-close",
    description: "Open close validation tasks",
    icon: Sparkles,
  },
] as const;

type ExceptionsPageContentProps = {
  data: ExceptionsData;
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: ExceptionsData,
): string {
  switch (label) {
    case "Total Exceptions":
      return String(data.counts.totalExceptions);
    case "Open Exceptions":
      return String(data.counts.openExceptions);
    case "Resolved Exceptions":
      return String(data.counts.resolvedExceptions);
    case "High Severity Exceptions":
      return String(data.counts.highSeverityItems);
    default:
      return "0";
  }
}

function hasExceptionActivity(data: ExceptionsData): boolean {
  return data.items.length > 0;
}

export function ExceptionsPageContent({ data }: ExceptionsPageContentProps) {
  const exceptionsNav = getNavItemByPathname("/exceptions");
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("all");
  const [itemSearch, setItemSearch] = useState("");

  if (!exceptionsNav) {
    throw new Error("Exceptions navigation item is not configured.");
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
        item.title,
        item.description ?? "",
        item.category,
        item.severity,
        item.status,
        item.source_type,
        item.source_id ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data.items, itemSearch, statusFilter]);

  return (
    <section aria-labelledby="exceptions-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="exceptions-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {exceptionsNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {exceptionsNav.description}
        </p>
      </header>

      {!hasExceptionActivity(data) ? (
        <WorkspaceDataEmpty message="No exceptions yet." />
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
        Exceptions shown here reflect recorded items in the current accounting
        data model. Automated remediation and AI-generated resolution decisions
        are not implemented.
      </p>

      <section
        aria-labelledby="exceptions-categories-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="exceptions-categories-title"
            className="text-lg font-semibold text-foreground"
          >
            Exception Categories
          </h2>
          <p className="text-sm text-muted-foreground">
            Live exception counts grouped by schema-backed categories.
          </p>
        </div>

        <div className="mt-6">
          {data.categories.length === 0 ? (
            <WorkspaceDataEmpty message="No exception categories yet." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.categories.map((category) => (
                <li
                  key={category.category}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {formatLabel(category.category)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {category.itemCount} item{category.itemCount === 1 ? "" : "s"}{" "}
                    · {category.openCount} open · {category.resolvedCount}{" "}
                    resolved · {category.dismissedCount} dismissed ·{" "}
                    {category.highSeverityCount} high severity
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="exceptions-items-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="exceptions-items-title"
            className="text-lg font-semibold text-foreground"
          >
            Exception Items
          </h2>
          <p className="text-sm text-muted-foreground">
            System-flagged anomalies and discrepancies from live organization
            records.
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
            Search exceptions
            <input
              className="mt-2 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Search by title, category, severity, or source"
              type="search"
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6">
          {data.items.length === 0 ? (
            <WorkspaceDataEmpty message="No exceptions yet." />
          ) : filteredItems.length === 0 ? (
            <WorkspaceDataEmpty message="No exceptions match the current filter." />
          ) : (
            <ExceptionItemsTable items={filteredItems} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="exceptions-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="exceptions-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected reconciliation and review areas.
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

export type { ExceptionsPageContentProps };
