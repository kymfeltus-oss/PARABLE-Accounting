export type JournalEntryDetailStatus = "draft" | "posted" | "reversed";

export type JournalEntryDetailSource =
  | "expense"
  | "giving"
  | "manual"
  | "banking"
  | "opening_balance"
  | "other";

export type JournalEntryLineView = {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  description?: string | null;
  debit: number;
  credit: number;
  fundCode?: string | null;
  fundName?: string | null;
};

export type JournalEntryDetailProps = {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  source: JournalEntryDetailSource;
  sourceReference?: string | null;
  periodName?: string | null;
  status: JournalEntryDetailStatus;
  lines: JournalEntryLineView[];
};

const sourceLabels: Record<JournalEntryDetailSource, string> = {
  expense: "Expense",
  giving: "Giving",
  manual: "Manual",
  banking: "Banking",
  opening_balance: "Opening balance",
  other: "Other",
};

const statusLabels: Record<JournalEntryDetailStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
};

const statusClasses: Record<JournalEntryDetailStatus, string> = {
  draft: "border-border bg-background text-muted-foreground",
  posted: "border-border bg-muted text-foreground",
  reversed: "border-destructive/40 bg-destructive/10 text-destructive",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatEntryDate(value: string): string {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(
        Date.UTC(
          Number(dateOnlyMatch[1]),
          Number(dateOnlyMatch[2]) - 1,
          Number(dateOnlyMatch[3]),
        ),
      )
    : new Date(value);

  if (
    Number.isNaN(date.getTime()) ||
    (dateOnlyMatch &&
      (date.getUTCFullYear() !== Number(dateOnlyMatch[1]) ||
        date.getUTCMonth() !== Number(dateOnlyMatch[2]) - 1 ||
        date.getUTCDate() !== Number(dateOnlyMatch[3])))
  ) {
    return "Invalid date";
  }

  return dateFormatter.format(date);
}

function formatFund(
  fundCode?: string | null,
  fundName?: string | null,
): string {
  if (fundCode && fundName) {
    return `${fundCode} — ${fundName}`;
  }

  return fundCode || fundName || "Unassigned";
}

function toCurrencyCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function isBalanced(totalDebit: number, totalCredit: number): boolean {
  return toCurrencyCents(totalDebit) === toCurrencyCents(totalCredit);
}

export function JournalEntryDetail({
  entryNumber,
  entryDate,
  description,
  source,
  sourceReference,
  periodName,
  status,
  lines,
}: JournalEntryDetailProps): React.ReactElement {
  const sortedLines = [...lines].sort(
    (left, right) => left.lineNumber - right.lineNumber,
  );
  const totalDebit = lines.reduce((total, line) => total + line.debit, 0);
  const totalCredit = lines.reduce((total, line) => total + line.credit, 0);
  const balanced = isBalanced(totalDebit, totalCredit);

  return (
    <article
      aria-labelledby="journal-entry-detail-title"
      className="max-w-full space-y-5"
    >
      <section className="rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="text-base font-semibold text-foreground"
              id="journal-entry-detail-title"
            >
              Journal entry
            </h2>
            <p
              className="mt-1 max-w-full break-words text-sm text-muted-foreground"
              data-testid="entry-number"
            >
              {entryNumber.trim() || "Unnumbered entry"}
            </p>
          </div>
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
          >
            {statusLabels[status]}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              Entry date
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatEntryDate(entryDate)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              Source
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {sourceLabels[source]}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              Accounting period
            </dt>
            <dd className="mt-1 break-words text-sm text-foreground">
              {periodName || "Unassigned"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              Status
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {statusLabels[status]}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              Description
            </dt>
            <dd className="mt-1 break-words text-sm text-foreground">
              {description}
            </dd>
          </div>
          {sourceReference ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">
                Source reference
              </dt>
              <dd className="mt-1 break-words text-sm text-foreground">
                {sourceReference}
              </dd>
            </div>
          ) : null}
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              Total debit
            </dt>
            <dd className="mt-1 text-sm text-foreground tabular-nums">
              {formatCurrency(totalDebit)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">
              Total credit
            </dt>
            <dd className="mt-1 text-sm text-foreground tabular-nums">
              {formatCurrency(totalCredit)}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              Balance state
            </dt>
            <dd
              className={`mt-1 text-sm font-medium ${balanced ? "text-foreground" : "text-destructive"}`}
              role="status"
            >
              {balanced ? "Balanced" : "Out of balance"}
            </dd>
          </div>
        </dl>
      </section>

      <div
        className="max-w-full overflow-x-auto rounded-lg border border-border bg-card"
        data-testid="journal-lines-scroll-container"
      >
        <table className="w-full min-w-[64rem] text-left text-sm">
          <caption className="sr-only">Journal entry lines</caption>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">
                Line
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Account code
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Account name
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Description
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Fund
              </th>
              <th className="px-3 py-3 text-right font-medium" scope="col">
                Debit
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLines.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={7}
                  role="status"
                >
                  No journal lines found.
                </td>
              </tr>
            ) : (
              sortedLines.map((line) => (
                <tr
                  className="border-b border-border last:border-b-0"
                  key={line.id}
                >
                  <th
                    className="px-4 py-3 font-medium text-foreground tabular-nums"
                    scope="row"
                  >
                    {line.lineNumber}
                  </th>
                  <td className="max-w-36 break-words px-3 py-3 text-foreground">
                    {line.accountCode}
                  </td>
                  <td className="max-w-56 break-words px-3 py-3 text-foreground">
                    {line.accountName}
                  </td>
                  <td className="max-w-64 break-words px-3 py-3 text-foreground">
                    {line.description || "—"}
                  </td>
                  <td className="max-w-48 break-words px-3 py-3 text-foreground">
                    {formatFund(line.fundCode, line.fundName)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-foreground tabular-nums">
                    {formatCurrency(line.debit)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-foreground tabular-nums">
                    {formatCurrency(line.credit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export {
  formatCurrency,
  formatEntryDate,
  formatFund,
  isBalanced,
  sourceLabels,
  statusLabels,
  toCurrencyCents,
};
