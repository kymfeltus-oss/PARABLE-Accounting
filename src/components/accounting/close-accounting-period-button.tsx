"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { closeAccountingPeriodAction } from "@/app/(workspace)/accounting/actions";
import { Button } from "@/components/ui/button";
import type { AccountingPeriodRecord } from "@/lib/data/accounting-repository";

type CloseAccountingPeriodButtonProps = {
  period: AccountingPeriodRecord;
};

export function CloseAccountingPeriodButton({
  period,
}: CloseAccountingPeriodButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (period.status !== "open") {
    return null;
  }

  function handleClose() {
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set("periodId", period.id);

    startTransition(async () => {
      const result = await closeAccountingPeriodAction(formData);

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }

      setSuccessMessage(`Accounting period "${result.period.name}" closed.`);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {confirming ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Close <span className="font-medium text-foreground">{period.name}</span>
            ? New journals cannot post to a closed period.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              size="sm"
              type="button"
              onClick={handleClose}
            >
              {isPending ? "Closing..." : "Yes, close period"}
            </Button>
            <Button
              disabled={isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          disabled={isPending}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Close Period
        </Button>
      )}
      {successMessage ? (
        <p aria-live="polite" className="text-xs text-foreground" role="status">
          {successMessage}
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

export type { CloseAccountingPeriodButtonProps };
