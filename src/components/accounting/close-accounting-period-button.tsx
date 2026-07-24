"use client";

import { useState, useTransition } from "react";

import { closeAccountingPeriodAction } from "@/app/(workspace)/accounting/actions";
import { Button } from "@/components/ui/button";
import type { AccountingPeriodRecord } from "@/lib/data/accounting-repository";

type CloseAccountingPeriodButtonProps = {
  period: AccountingPeriodRecord;
};

export function CloseAccountingPeriodButton({
  period,
}: CloseAccountingPeriodButtonProps) {
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
        return;
      }

      setSuccessMessage(`Accounting period "${result.period.name}" closed.`);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <Button
        disabled={isPending}
        size="sm"
        type="button"
        variant="outline"
        onClick={handleClose}
      >
        {isPending ? "Closing..." : "Close Period"}
      </Button>
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
