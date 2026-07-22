"use client";

import { useState, useTransition } from "react";

import { updateExceptionStatusAction } from "@/app/(workspace)/exceptions/actions";
import type { ExceptionStatus } from "@/lib/data/exceptions-repository";

const STATUS_OPTIONS: readonly ExceptionStatus[] = [
  "open",
  "resolved",
  "dismissed",
];

function formatStatus(status: ExceptionStatus): string {
  return status.replace(/_/g, " ");
}

type ExceptionStatusControlProps = {
  exceptionId: string;
  status: ExceptionStatus;
};

export function ExceptionStatusControl({
  exceptionId,
  status: initialStatus,
}: ExceptionStatusControlProps) {
  const [status, setStatus] = useState<ExceptionStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as ExceptionStatus;

    if (nextStatus === status) {
      return;
    }

    const previousStatus = status;

    setError(null);
    setStatus(nextStatus);

    startTransition(async () => {
      const result = await updateExceptionStatusAction({
        exceptionId,
        nextStatus,
      });

      if (!result.ok) {
        setStatus(previousStatus);
        setError(result.error);
        return;
      }

      setStatus(result.item.status as ExceptionStatus);
    });
  }

  return (
    <div className="space-y-1">
      <label className="sr-only" htmlFor={`exception-status-${exceptionId}`}>
        Exception status
      </label>
      <select
        id={`exception-status-${exceptionId}`}
        aria-busy={isPending}
        aria-label="Exception status"
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

export type { ExceptionStatusControlProps };
