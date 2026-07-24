export type RecordedExpenseJournalPanelProps = {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  status: "posted" | "draft" | "reversed" | "void";
  totalDebit: number;
  totalCredit: number;
  periodName?: string | null;
  sourceReference?: string | null;
  href?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const statusLabels: Record<RecordedExpenseJournalPanelProps["status"], string> =
  {
    posted: "Posted",
    draft: "Draft",
    reversed: "Reversed",
    void: "VOID",
  };

const statusClasses: Record<
  RecordedExpenseJournalPanelProps["status"],
  string
> = {
  posted: "border-border bg-muted text-foreground",
  draft: "border-border bg-background text-muted-foreground",
  reversed: "border-destructive/40 bg-destructive/10 text-destructive",
  void: "border-destructive/40 bg-destructive/10 text-destructive",
};

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function toCurrencyCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function isBalanced(totalDebit: number, totalCredit: number): boolean {
  return toCurrencyCents(totalDebit) === toCurrencyCents(totalCredit);
}

export function RecordedExpenseJournalPanel({
  journalEntryId,
  entryNumber,
  entryDate,
  status,
  totalDebit,
  totalCredit,
  periodName,
  sourceReference,
  href,
}: RecordedExpenseJournalPanelProps): React.ReactElement {
  const balanced = isBalanced(totalDebit, totalCredit);
  const displayEntryNumber = entryNumber.trim() || journalEntryId;

  return (
    <section
      aria-labelledby="recorded-expense-journal-title"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="recorded-expense-journal-title"
            className="text-base font-semibold text-foreground"
          >
            Journal Entry
          </h2>
          <p
            className="mt-1 max-w-full break-words text-sm text-muted-foreground"
            data-testid="journal-entry-number"
          >
            {displayEntryNumber}
          </p>
        </div>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Entry date
          </dt>
          <dd className="mt-1 text-sm text-foreground">{entryDate}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Status</dt>
          <dd className="mt-1 text-sm text-foreground">{statusLabels[status]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Total debit
          </dt>
          <dd className="mt-1 text-sm tabular-nums text-foreground">
            {formatCurrency(totalDebit)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Total credit
          </dt>
          <dd className="mt-1 text-sm tabular-nums text-foreground">
            {formatCurrency(totalCredit)}
          </dd>
        </div>
        {periodName ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Accounting period
            </dt>
            <dd className="mt-1 break-words text-sm text-foreground">
              {periodName}
            </dd>
          </div>
        ) : null}
        {sourceReference ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Source reference
            </dt>
            <dd className="mt-1 break-words text-sm text-foreground">
              {sourceReference}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p
          className={`text-sm font-medium ${balanced ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {balanced ? "Balanced" : "Out of balance"}
        </p>
        {href ? (
          <a
            className="rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href={href}
          >
            View journal entry
          </a>
        ) : null}
      </div>
    </section>
  );
}

export { formatCurrency, isBalanced, toCurrencyCents };
