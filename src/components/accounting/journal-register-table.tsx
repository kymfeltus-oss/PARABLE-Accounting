"use client";

import { Button } from "@/components/ui/button";

export type JournalRegisterStatus = "draft" | "posted" | "reversed" | "void";

export type JournalRegisterSource =
  | "expense"
  | "giving"
  | "manual"
  | "banking"
  | "opening_balance"
  | "other";

export type JournalRegisterRow = {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  source: JournalRegisterSource;
  sourceReference?: string | null;
  periodName?: string | null;
  status: JournalRegisterStatus;
  totalDebit: number;
  totalCredit: number;
};

export type JournalRegisterFilters = {
  search: string;
  status: "all" | JournalRegisterStatus;
  source: "all" | JournalRegisterSource;
};

export type JournalRegisterTableProps = {
  rows: JournalRegisterRow[];
  filters: JournalRegisterFilters;
  onFiltersChange: (filters: JournalRegisterFilters) => void;
  onViewEntry?: (journalEntryId: string) => void;
  isLoading?: boolean;
};

const sourceLabels: Record<JournalRegisterSource, string> = {
  expense: "Expense",
  giving: "Giving",
  manual: "Manual",
  banking: "Banking",
  opening_balance: "Opening balance",
  other: "Other",
};

const statusLabels: Record<JournalRegisterStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
  void: "VOID",
};

const statusClasses: Record<JournalRegisterStatus, string> = {
  draft: "border-border bg-background text-muted-foreground",
  posted: "border-border bg-muted text-foreground",
  reversed: "border-destructive/40 bg-destructive/10 text-destructive",
  void: "border-destructive/40 bg-destructive/10 text-destructive",
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

const inputClassName =
  "mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

function toCurrencyCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function isBalanced(totalDebit: number, totalCredit: number): boolean {
  return toCurrencyCents(totalDebit) === toCurrencyCents(totalCredit);
}

export function JournalRegisterTable({
  rows,
  filters,
  onFiltersChange,
  onViewEntry,
  isLoading = false,
}: JournalRegisterTableProps): React.ReactElement {
  return (
    <section
      aria-labelledby="journal-register-title"
      className="max-w-full space-y-4"
    >
      <h2
        className="text-base font-semibold text-foreground"
        id="journal-register-title"
      >
        Journal register
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-foreground">
          Search journal entries
          <input
            className={inputClassName}
            type="search"
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
          />
        </label>

        <label className="text-sm font-medium text-foreground">
          Status
          <select
            className={inputClassName}
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as JournalRegisterFilters["status"],
              })
            }
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
            <option value="void">VOID</option>
          </select>
        </label>

        <label className="text-sm font-medium text-foreground">
          Source
          <select
            className={inputClassName}
            value={filters.source}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                source: event.target.value as JournalRegisterFilters["source"],
              })
            }
          >
            <option value="all">All sources</option>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="max-w-full overflow-x-auto rounded-lg border border-border bg-card"
        data-testid="journal-table-scroll-container"
      >
        <table className="w-full min-w-[76rem] text-left text-sm">
          <caption className="sr-only">Journal register</caption>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">
                Entry number
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Entry date
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Description
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Source
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Accounting period
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Status
              </th>
              <th className="px-3 py-3 text-right font-medium" scope="col">
                Total debit
              </th>
              <th className="px-3 py-3 text-right font-medium" scope="col">
                Total credit
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Balance state
              </th>
              {onViewEntry ? (
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  Action
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={onViewEntry ? 10 : 9}
                  role="status"
                >
                  Loading journal entries…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={onViewEntry ? 10 : 9}
                  role="status"
                >
                  No journal entries found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const balanced = isBalanced(
                  row.totalDebit,
                  row.totalCredit,
                );

                return (
                  <tr className="border-b border-border last:border-b-0" key={row.id}>
                    <th
                      className="max-w-44 break-words px-4 py-3 font-medium text-foreground"
                      scope="row"
                    >
                      {row.entryNumber.trim() || "Unnumbered entry"}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {formatEntryDate(row.entryDate)}
                    </td>
                    <td className="max-w-64 px-3 py-3">
                      <p className="break-words text-foreground">
                        {row.description}
                      </p>
                      {row.sourceReference ? (
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {row.sourceReference}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {sourceLabels[row.source]}
                    </td>
                    <td className="max-w-40 break-words px-3 py-3 text-foreground">
                      {row.periodName || "Unassigned"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClasses[row.status]}`}
                      >
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-foreground tabular-nums">
                      {formatCurrency(row.totalDebit)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-foreground tabular-nums">
                      {formatCurrency(row.totalCredit)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-3 ${balanced ? "text-foreground" : "text-destructive"}`}
                    >
                      {balanced ? "Balanced" : "Out of balance"}
                    </td>
                    {onViewEntry ? (
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => onViewEntry(row.id)}
                        >
                          View
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export {
  formatCurrency,
  formatEntryDate,
  isBalanced,
  sourceLabels,
  statusLabels,
  toCurrencyCents,
};
