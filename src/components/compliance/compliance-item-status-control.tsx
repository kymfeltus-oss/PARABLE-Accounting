"use client";

import { useState, useTransition } from "react";

import { updateComplianceItemStatusAction } from "@/app/(workspace)/compliance/actions";
import type { ComplianceItemStatus } from "@/lib/data/compliance-repository";

const STATUS_OPTIONS: readonly ComplianceItemStatus[] = [
  "open",
  "completed",
  "not_applicable",
];

function formatStatus(status: ComplianceItemStatus): string {
  return status.replace(/_/g, " ");
}

type ComplianceItemStatusControlProps = {
  itemId: string;
  status: ComplianceItemStatus;
};

export function ComplianceItemStatusControl({
  itemId,
  status: initialStatus,
}: ComplianceItemStatusControlProps) {
  const [status, setStatus] = useState<ComplianceItemStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as ComplianceItemStatus;

    if (nextStatus === status) {
      return;
    }

    const previousStatus = status;

    setError(null);
    setStatus(nextStatus);

    startTransition(async () => {
      const result = await updateComplianceItemStatusAction({
        itemId,
        nextStatus,
      });

      if (!result.ok) {
        setStatus(previousStatus);
        setError(result.error);
        return;
      }

      setStatus(result.item.status as ComplianceItemStatus);
    });
  }

  return (
    <div className="space-y-1">
      <label className="sr-only" htmlFor={`compliance-status-${itemId}`}>
        Compliance item status
      </label>
      <select
        id={`compliance-status-${itemId}`}
        aria-busy={isPending}
        aria-label="Compliance item status"
        className="w-full min-w-36 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        value={status}
        onChange={handleChange}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {formatStatus(option)}
          </option>
        ))}
      </select>
      {isPending ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          Updating status...
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type { ComplianceItemStatusControlProps };
