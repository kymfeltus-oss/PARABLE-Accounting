"use client";

import type { AuditEventRow } from "@/lib/data/types/rows";

type AuditEventsTableProps = {
  events: AuditEventRow[];
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AuditEventsTable({ events }: AuditEventsTableProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No audit events match the current filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Actor</th>
            <th className="px-3 py-2 font-medium">Occurred</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-border/70 align-top">
              <td className="px-3 py-3">
                <p className="font-medium text-foreground">
                  {formatLabel(event.event_type)}
                </p>
                {event.description ? (
                  <p className="mt-1 text-muted-foreground">{event.description}</p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(event.source_type)}
                {event.source_id ? ` · ${event.source_id}` : ""}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatLabel(event.actor_type)}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {formatDateTime(event.occurred_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { AuditEventsTableProps };
