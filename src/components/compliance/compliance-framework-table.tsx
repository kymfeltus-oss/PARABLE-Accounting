"use client";

import { ComplianceItemStatusControl } from "@/components/compliance/compliance-item-status-control";
import type { ComplianceItemStatus } from "@/lib/data/compliance-repository";
import type { ComplianceItemRow } from "@/lib/data/types/rows";

type ComplianceFrameworkTableProps = {
  items: ComplianceItemRow[];
};

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}

function isComplianceItemStatus(status: string): status is ComplianceItemStatus {
  return status === "open" || status === "completed" || status === "not_applicable";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ComplianceFrameworkTable({
  items,
}: ComplianceFrameworkTableProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No compliance items match the current filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Due Date</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-3">
                <p className="font-medium text-foreground">{item.name}</p>
                {item.description ? (
                  <p className="mt-1 text-muted-foreground">{item.description}</p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatCategory(item.category)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {isComplianceItemStatus(item.status) ? (
                  <ComplianceItemStatusControl
                    itemId={item.id}
                    status={item.status}
                  />
                ) : (
                  item.status
                )}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDate(item.due_date)}
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

export type { ComplianceFrameworkTableProps };
