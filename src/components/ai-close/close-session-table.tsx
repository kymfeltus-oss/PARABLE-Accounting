"use client";

import type { CloseSessionRecord } from "@/lib/data/ai-close-repository";

type CloseSessionTableProps = {
  sessions: CloseSessionRecord[];
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCloseType(closeType: string): string {
  return closeType.replace(/_/g, " ");
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function CloseSessionTable({ sessions }: CloseSessionTableProps) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No close sessions match the current filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Period</th>
            <th className="px-3 py-2 font-medium">Close Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Tasks</th>
            <th className="px-3 py-2 font-medium">Started</th>
            <th className="px-3 py-2 font-medium">Completed</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className="border-b border-border/70">
              <td className="px-3 py-3 font-medium text-foreground">
                {session.periodName ?? "Unknown period"}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatCloseType(session.close_type)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatStatus(session.status)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {session.taskCount} total · {session.pendingTaskCount} pending ·{" "}
                {session.inProgressTaskCount} in progress ·{" "}
                {session.completedTaskCount} completed
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(session.started_at)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(session.completed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { CloseSessionTableProps };
