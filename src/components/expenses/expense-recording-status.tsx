export type ExpenseRecordingStatusProps = {
  recordedAt?: string | null;
  recordedByName?: string | null;
  journalEntryNumber?: string | null;
};

export function ExpenseRecordingStatus({
  recordedAt,
  recordedByName,
  journalEntryNumber,
}: ExpenseRecordingStatusProps): React.ReactElement {
  return (
    <section
      aria-labelledby="expense-recording-status-title"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
      role="status"
    >
      <h2
        id="expense-recording-status-title"
        className="text-base font-semibold text-foreground"
      >
        Expense recorded
      </h2>

      <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        <p>This expense is now read-only.</p>
        <p>An accounting journal entry was created for this expense.</p>
        <p>
          Changes require a separate correction or reversal workflow.
        </p>
      </div>

      {recordedAt || recordedByName || journalEntryNumber ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
          {recordedAt ? (
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                Recorded at
              </dt>
              <dd className="mt-1 break-words text-sm text-foreground">
                {recordedAt}
              </dd>
            </div>
          ) : null}

          {recordedByName ? (
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                Recorded by
              </dt>
              <dd className="mt-1 break-words text-sm text-foreground">
                {recordedByName}
              </dd>
            </div>
          ) : null}

          {journalEntryNumber ? (
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                Journal entry
              </dt>
              <dd
                className="mt-1 max-w-full break-words text-sm text-foreground"
                data-testid="journal-entry-number"
              >
                {journalEntryNumber}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
