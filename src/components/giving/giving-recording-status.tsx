export type GivingRecordingStatusProps = {
  journalEntryNumber?: string | null;
};

export function GivingRecordingStatus({
  journalEntryNumber,
}: GivingRecordingStatusProps): React.ReactElement {
  return (
    <section
      aria-labelledby="giving-recording-status-title"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
      role="status"
    >
      <h2
        id="giving-recording-status-title"
        className="text-base font-semibold text-foreground"
      >
        Giving recorded to ledger
      </h2>

      <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        <p>This giving transaction is linked to the general ledger.</p>
        <p>An accounting journal entry was created for this gift.</p>
      </div>

      {journalEntryNumber ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
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
        </dl>
      ) : null}
    </section>
  );
}
