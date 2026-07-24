"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export type JournalVoidSubmitInput = {
  journalEntryId: string;
  reason: string;
};

export type JournalVoidSubmitResult =
  | {
      success: true;
      journalEntryId: string;
      entryNumber: string;
    }
  | {
      success: false;
      message: string;
    };

export type JournalVoidFormProps = {
  journalEntryId: string;
  originalEntryNumber: string;
  onSubmit: (input: JournalVoidSubmitInput) => Promise<JournalVoidSubmitResult>;
  onVoided?: (result: { journalEntryId: string; entryNumber: string }) => void;
};

const textareaClassName =
  "mt-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function JournalVoidForm({
  journalEntryId,
  originalEntryNumber,
  onSubmit,
  onVoided,
}: JournalVoidFormProps): React.ReactElement {
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [voidedEntryNumber, setVoidedEntryNumber] = useState<string | null>(
    null,
  );

  const canSubmit =
    !isPending && voidedEntryNumber == null && reason.trim() !== "";

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
        reason: reason.trim(),
      });

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setVoidedEntryNumber(result.entryNumber);
      onVoided?.({
        journalEntryId: result.journalEntryId,
        entryNumber: result.entryNumber,
      });
    } catch {
      setErrorMessage("The journal entry could not be voided. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  if (voidedEntryNumber) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-5 text-card-foreground"
        role="status"
      >
        <h3 className="text-sm font-semibold text-foreground">Journal voided</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Journal{" "}
          <span className="font-medium text-foreground">
            {voidedEntryNumber || originalEntryNumber}
          </span>{" "}
          is now marked void. It remains searchable and auditable, and is
          excluded from default financial reports.
        </p>
      </div>
    );
  }

  return (
    <form
      aria-labelledby="journal-void-form-title"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
      onSubmit={handleSubmit}
    >
      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="sr-only">Void Journal</legend>

        <div>
          <h3
            className="text-sm font-semibold text-foreground"
            id="journal-void-form-title"
          >
            Void Journal
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Voiding marks this posted journal as void without creating an
            offsetting entry. The journal remains on file for audit and search.
            This cannot be undone from this screen.
          </p>
        </div>

        <div>
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="void-reason"
          >
            Void reason
          </label>
          <textarea
            className={textareaClassName}
            id="void-reason"
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
          {isPending ? "Voiding journal…" : "Ready to void this journal."}
        </p>

        <Button disabled={!canSubmit} type="submit">
          {isPending ? "Voiding…" : "Void Journal"}
        </Button>
      </fieldset>
    </form>
  );
}
