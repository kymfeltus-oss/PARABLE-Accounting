"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export type JournalReversalPeriodOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

export type JournalReversalSubmitInput = {
  journalEntryId: string;
  reversalDate: string;
  periodId: string;
  reason: string;
};

export type JournalReversalSubmitResult =
  | {
      success: true;
      journalEntryId: string;
      entryNumber: string;
    }
  | {
      success: false;
      message: string;
    };

export type JournalReversalFormProps = {
  journalEntryId: string;
  originalEntryNumber: string;
  periods: JournalReversalPeriodOption[];
  onSubmit: (
    input: JournalReversalSubmitInput,
  ) => Promise<JournalReversalSubmitResult>;
  onCreated?: (result: {
    journalEntryId: string;
    entryNumber: string;
  }) => void;
};

const inputClassName =
  "mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "mt-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function JournalReversalForm({
  journalEntryId,
  originalEntryNumber,
  periods,
  onSubmit,
  onCreated,
}: JournalReversalFormProps): React.ReactElement {
  const openPeriods = periods.filter((period) => period.isOpen);
  const [reversalDate, setReversalDate] = useState("");
  const [periodId, setPeriodId] = useState(openPeriods[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [createdEntryNumber, setCreatedEntryNumber] = useState<string | null>(
    null,
  );

  const canSubmit =
    !isPending &&
    createdEntryNumber == null &&
    openPeriods.length > 0 &&
    isValidIsoDate(reversalDate) &&
    periodId.trim() !== "" &&
    reason.trim() !== "";

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!canSubmit || isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await onSubmit({
        journalEntryId,
        reversalDate: reversalDate.trim(),
        periodId: periodId.trim(),
        reason: reason.trim(),
      });

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setCreatedEntryNumber(result.entryNumber);
      onCreated?.({
        journalEntryId: result.journalEntryId,
        entryNumber: result.entryNumber,
      });
    } catch {
      setErrorMessage("The journal entry could not be reversed. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  if (createdEntryNumber) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-5 text-card-foreground"
        role="status"
      >
        <h3 className="text-sm font-semibold text-foreground">
          Reversal created
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Reversal journal{" "}
          <span className="font-medium text-foreground">
            {createdEntryNumber}
          </span>{" "}
          was posted. Original journal {originalEntryNumber} remains on file and
          is now marked reversed.
        </p>
      </div>
    );
  }

  return (
    <form
      aria-labelledby="journal-reversal-form-title"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
      onSubmit={handleSubmit}
    >
      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="sr-only">Reverse journal entry</legend>

        <div>
          <h3
            className="text-sm font-semibold text-foreground"
            id="journal-reversal-form-title"
          >
            Reverse journal
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The original journal will remain unchanged. A new posted journal will
            be created with debits and credits reversed. This Phase 8.4 workflow
            cannot undo the reversal.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="reversal-date">
            Reversal date
          </label>
          <input
            className={inputClassName}
            id="reversal-date"
            onChange={(event) => setReversalDate(event.target.value)}
            required
            type="date"
            value={reversalDate}
          />
        </div>

        <div>
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="reversal-period"
          >
            Open accounting period
          </label>
          <select
            className={inputClassName}
            id="reversal-period"
            onChange={(event) => setPeriodId(event.target.value)}
            required
            value={periodId}
          >
            {openPeriods.length === 0 ? (
              <option value="">No open periods available</option>
            ) : null}
            {openPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name} ({period.startDate} – {period.endDate})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="reversal-reason"
          >
            Reversal reason
          </label>
          <textarea
            className={textareaClassName}
            id="reversal-reason"
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
          {isPending ? "Creating reversal…" : "Ready to reverse this journal."}
        </p>

        <Button disabled={!canSubmit} type="submit">
          {isPending ? "Reversing…" : "Reverse journal"}
        </Button>
      </fieldset>
    </form>
  );
}
