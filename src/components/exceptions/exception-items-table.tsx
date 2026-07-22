"use client";

import { ExceptionStatusControl } from "@/components/exceptions/exception-status-control";
import type { ExceptionStatus } from "@/lib/data/exceptions-repository";
import type { ExceptionRow } from "@/lib/data/types/rows";

type ExceptionItemsTableProps = {
  items: ExceptionRow[];
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function isExceptionStatus(status: string): status is ExceptionStatus {
  return status === "open" || status === "resolved" || status === "dismissed";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ExceptionItemsTable({ items }: ExceptionItemsTableProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No exceptions match the current filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-3">
                <p className="font-medium text-foreground">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-muted-foreground">{item.description}</p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(item.category)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(item.severity)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {isExceptionStatus(item.status) ? (
                  <ExceptionStatusControl
                    exceptionId={item.id}
                    status={item.status}
                  />
                ) : (
                  formatLabel(item.status)
                )}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(item.source_type)}
                {item.source_id ? ` · ${item.source_id}` : ""}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(item.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { ExceptionItemsTableProps };
