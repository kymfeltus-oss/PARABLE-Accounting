"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { CloseSessionTable } from "@/components/ai-close/close-session-table";
import { Button } from "@/components/ui/button";
import { getNavItemByPathname } from "@/config/navigation";
import { WorkspaceDataEmpty } from "@/components/workspace/workspace-data-empty";
import type { AiCloseData } from "@/lib/data/ai-close-repository";

const summaryLabels = [
  "Close Sessions",
  "In Progress Sessions",
  "Open Tasks",
  "Completed Tasks",
] as const;

const sessionFilters = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
] as const;

type SessionFilterId = (typeof sessionFilters)[number]["id"];

const navigationLinks = [
  {
    id: "accounting",
    label: "Accounting",
    href: "/accounting",
    description: "Review ledger periods and journal activity",
    icon: BookOpen,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    description: "Open report-ready summaries",
    icon: FileText,
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/compliance",
    description: "Review compliance close requirements",
    icon: ShieldCheck,
  },
  {
    id: "exceptions",
    label: "Exceptions",
    href: "/exceptions",
    description: "Inspect items requiring close attention",
    icon: TriangleAlert,
  },
] as const;

type AiClosePageContentProps = {
  data: AiCloseData;
};

function formatSummaryValue(
  label: (typeof summaryLabels)[number],
  data: AiCloseData,
): string {
  switch (label) {
    case "Close Sessions":
      return String(data.counts.totalSessions);
    case "In Progress Sessions":
      return String(data.counts.inProgressSessions);
    case "Open Tasks":
      return String(data.counts.pendingTasks + data.counts.inProgressTasks);
    case "Completed Tasks":
      return String(data.counts.completedTasks);
    default:
      return "0";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTaskType(taskType: string): string {
  return taskType.replace(/_/g, " ");
}

function hasCloseActivity(data: AiCloseData): boolean {
  return data.sessions.length > 0 || data.pendingTasks.length > 0;
}

export function AiClosePageContent({ data }: AiClosePageContentProps) {
  const aiCloseNav = getNavItemByPathname("/ai-close");
  const [sessionFilter, setSessionFilter] = useState<SessionFilterId>("all");
  const [taskSearch, setTaskSearch] = useState("");

  if (!aiCloseNav) {
    throw new Error("AI Close navigation item is not configured.");
  }

  const filteredSessions = useMemo(() => {
    if (sessionFilter === "all") {
      return data.sessions;
    }

    return data.sessions.filter((session) => session.status === sessionFilter);
  }, [data.sessions, sessionFilter]);

  const filteredPendingTasks = useMemo(() => {
    const normalizedSearch = taskSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return data.pendingTasks;
    }

    return data.pendingTasks.filter((task) => {
      const haystack = [
        task.title,
        task.description ?? "",
        task.task_type,
        task.periodName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [data.pendingTasks, taskSearch]);

  return (
    <section aria-labelledby="ai-close-title" className="space-y-8">
      <header className="space-y-2">
        <h1
          id="ai-close-title"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          {aiCloseNav.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {aiCloseNav.description}
        </p>
      </header>

      <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-6">
        <p className="text-sm leading-6 text-muted-foreground">
          AI confidence scores, automated reconciliation, and suggested close
          actions are not available yet. This page shows live close sessions and
          tasks only. Close an accounting period from Accounting.
        </p>
        <Button asChild type="button" variant="outline">
          <Link href="/accounting">Open accounting</Link>
        </Button>
      </div>

      {!hasCloseActivity(data) ? (
        <WorkspaceDataEmpty message="No close sessions or tasks yet." />
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

      <section
        aria-labelledby="ai-close-sessions-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="ai-close-sessions-title"
            className="text-lg font-semibold text-foreground"
          >
            Close Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Live close sessions with task progress by accounting period.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sessionFilters.map((filter) => (
            <Button
              key={filter.id}
              aria-pressed={sessionFilter === filter.id}
              size="sm"
              type="button"
              variant={sessionFilter === filter.id ? "default" : "outline"}
              onClick={() => setSessionFilter(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          {data.sessions.length === 0 ? (
            <WorkspaceDataEmpty message="No close sessions yet." />
          ) : (
            <CloseSessionTable sessions={filteredSessions} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="ai-close-tasks-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="ai-close-tasks-title"
            className="text-lg font-semibold text-foreground"
          >
            Open Close Tasks
          </h2>
          <p className="text-sm text-muted-foreground">
            Pending and in-progress validation tasks from live close sessions.
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-foreground">
            Search tasks
            <input
              className="mt-2 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Search by title, type, or period"
              type="search"
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6">
          {data.pendingTasks.length === 0 ? (
            <WorkspaceDataEmpty message="No open close tasks." />
          ) : filteredPendingTasks.length === 0 ? (
            <WorkspaceDataEmpty message="No tasks match the current search." />
          ) : (
            <ul className="space-y-3">
              {filteredPendingTasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-border p-4 text-sm"
                >
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatTaskType(task.task_type)} · {task.status.replace(/_/g, " ")}
                    {task.periodName ? ` · ${task.periodName}` : ""}
                    {task.closeType
                      ? ` · ${task.closeType.replace(/_/g, " ")}`
                      : ""}
                  </p>
                  {task.description ? (
                    <p className="mt-2 text-muted-foreground">{task.description}</p>
                  ) : null}
                  <p className="mt-2 text-muted-foreground">
                    Due {formatDateTime(task.due_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="ai-close-related-workspaces-title"
        className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="ai-close-related-workspaces-title"
            className="text-lg font-semibold text-foreground"
          >
            Related Workspaces
          </h2>
          <p className="text-sm text-muted-foreground">
            Navigate to connected close and review areas.
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

export type { AiClosePageContentProps };
