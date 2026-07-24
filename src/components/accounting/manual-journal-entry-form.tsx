"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export type ManualJournalAccountOption = {
  id: string;
  code: string;
  name: string;
};

export type ManualJournalFundOption = {
  id: string;
  code: string;
  name: string;
};

export type ManualJournalPeriodOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

export type ManualJournalLineInput = {
  clientId: string;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
  fundId: string;
};

export type ManualJournalSubmitInput = {
  entryDate: string;
  description: string;
  periodId: string;
  lines: Array<{
    accountId: string;
    description: string | null;
    debit: number;
    credit: number;
    fundId: string | null;
  }>;
};

export type ManualJournalSubmitResult =
  | {
      success: true;
      journalEntryId: string;
      entryNumber: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type ManualJournalEntryFormProps = {
  accounts: ManualJournalAccountOption[];
  funds: ManualJournalFundOption[];
  periods: ManualJournalPeriodOption[];
  onSubmit: (
    input: ManualJournalSubmitInput,
  ) => Promise<ManualJournalSubmitResult>;
  onCreated?: (result: {
    journalEntryId: string;
    entryNumber: string;
  }) => void;
};

const inputClassName =
  "mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

let nextLineId = 0;

function createLine(): ManualJournalLineInput {
  nextLineId += 1;
  return {
    clientId: `manual-journal-line-${nextLineId}`,
    accountId: "",
    description: "",
    debit: "",
    credit: "",
    fundId: "",
  };
}

function parseAmount(value: string): number | null {
  if (value.trim() === "") {
    return 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function toCurrencyCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function validateLine(line: ManualJournalLineInput): {
  account?: string;
  amount?: string;
} {
  const debit = parseAmount(line.debit);
  const credit = parseAmount(line.credit);
  const errors: { account?: string; amount?: string } = {};

  if (!line.accountId) {
    errors.account = "Account is required.";
  }

  if (debit === null || credit === null) {
    errors.amount = "Enter valid nonnegative debit and credit amounts.";
  } else if (debit > 0 && credit > 0) {
    errors.amount = "A line cannot contain both a debit and a credit.";
  } else if (debit <= 0 && credit <= 0) {
    errors.amount = "Enter a positive debit or credit amount.";
  }

  return errors;
}

export function ManualJournalEntryForm({
  accounts,
  funds,
  periods,
  onSubmit,
  onCreated,
}: ManualJournalEntryFormProps): React.ReactElement {
  const openPeriods = periods.filter((period) => period.isOpen);
  const [entryDate, setEntryDate] = useState("");
  const [periodId, setPeriodId] = useState(openPeriods[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<ManualJournalLineInput[]>(() => [
    createLine(),
    createLine(),
  ]);
  const [isPending, setIsPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdEntryNumber, setCreatedEntryNumber] = useState<string | null>(
    null,
  );

  const parsedLines = lines.map((line) => ({
    debit: parseAmount(line.debit),
    credit: parseAmount(line.credit),
  }));
  const debitCents = parsedLines.reduce(
    (total, line) =>
      total + (line.debit === null ? 0 : toCurrencyCents(line.debit)),
    0,
  );
  const creditCents = parsedLines.reduce(
    (total, line) =>
      total + (line.credit === null ? 0 : toCurrencyCents(line.credit)),
    0,
  );
  const balanced = debitCents === creditCents;
  const nonzero = debitCents > 0 || creditCents > 0;
  const linesValid = lines.every(
    (line) => Object.keys(validateLine(line)).length === 0,
  );
  const blocked = accounts.length === 0 || openPeriods.length === 0;
  const canSubmit =
    !blocked &&
    !isPending &&
    Boolean(entryDate) &&
    Boolean(periodId) &&
    linesValid &&
    balanced &&
    nonzero;

  function updateLine(
    clientId: string,
    field: keyof Omit<ManualJournalLineInput, "clientId">,
    value: string,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.clientId === clientId ? { ...line, [field]: value } : line,
      ),
    );
    setFieldErrors({});
    setActionError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isPending) {
      return;
    }

    const input: ManualJournalSubmitInput = {
      entryDate,
      description: description.trim(),
      periodId,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        description: line.description.trim() || null,
        debit: parseAmount(line.debit) ?? 0,
        credit: parseAmount(line.credit) ?? 0,
        fundId: line.fundId || null,
      })),
    };

    setIsPending(true);
    setFieldErrors({});
    setActionError(null);

    try {
      const result = await onSubmit(input);
      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        setActionError(result.message);
        setIsPending(false);
        return;
      }

      const created = {
        journalEntryId: result.journalEntryId,
        entryNumber: result.entryNumber,
      };
      setCreatedEntryNumber(result.entryNumber);
      setIsPending(false);
      onCreated?.(created);
    } catch {
      setActionError(
        "Unable to create the journal entry. Please try again.",
      );
      setIsPending(false);
    }
  }

  if (createdEntryNumber) {
    return (
      <section
        aria-labelledby="manual-journal-success-title"
        className="rounded-lg border border-border bg-card p-5"
        role="status"
      >
        <h2
          className="text-base font-semibold text-foreground"
          id="manual-journal-success-title"
        >
          Manual journal entry created
        </h2>
        <p className="mt-2 break-words text-sm text-muted-foreground">
          Entry {createdEntryNumber} was created successfully.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="manual-journal-title"
      className="max-w-full space-y-4"
    >
      <h2
        className="text-base font-semibold text-foreground"
        id="manual-journal-title"
      >
        Create manual journal entry
      </h2>

      {blocked ? (
        <p
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          {accounts.length === 0
            ? "No accounts are available for a manual journal entry."
            : "No open accounting periods are available."}
        </p>
      ) : null}

      <form className="max-w-full space-y-5" noValidate onSubmit={handleSubmit}>
        <fieldset disabled={blocked || isPending}>
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
            <label className="text-sm font-medium text-foreground">
              Entry date
              <input
                aria-describedby={
                  fieldErrors.entryDate ? "entry-date-error" : undefined
                }
                className={inputClassName}
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              Accounting period
              <select
                aria-describedby={
                  fieldErrors.periodId ? "period-error" : undefined
                }
                className={inputClassName}
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
              >
                {openPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              Description
              <input
                aria-describedby={
                  fieldErrors.description ? "description-error" : undefined
                }
                className={inputClassName}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          {fieldErrors.entryDate ? (
            <p className="mt-2 text-sm text-destructive" id="entry-date-error">
              {fieldErrors.entryDate}
            </p>
          ) : null}
          {fieldErrors.periodId ? (
            <p className="mt-2 text-sm text-destructive" id="period-error">
              {fieldErrors.periodId}
            </p>
          ) : null}
          {fieldErrors.description ? (
            <p className="mt-2 text-sm text-destructive" id="description-error">
              {fieldErrors.description}
            </p>
          ) : null}

          <div className="mt-5 max-w-full space-y-3">
            {lines.map((line, index) => {
              const validation = validateLine(line);
              const accountError =
                fieldErrors[`lines.${index}.accountId`] ?? validation.account;
              const amountError =
                fieldErrors[`lines.${index}.amount`] ?? validation.amount;
              const accountErrorId = `${line.clientId}-account-error`;
              const amountErrorId = `${line.clientId}-amount-error`;

              return (
                <fieldset
                  className="min-w-0 rounded-lg border border-border bg-card p-4"
                  key={line.clientId}
                >
                  <legend className="px-1 text-sm font-medium text-foreground">
                    Journal line {index + 1}
                  </legend>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1fr_.7fr_.7fr_auto]">
                    <label className="min-w-0 text-xs font-medium text-muted-foreground">
                      Account
                      <select
                        aria-describedby={
                          accountError ? accountErrorId : undefined
                        }
                        aria-invalid={Boolean(accountError)}
                        className={inputClassName}
                        value={line.accountId}
                        onChange={(event) =>
                          updateLine(
                            line.clientId,
                            "accountId",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Select account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} — {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 text-xs font-medium text-muted-foreground">
                      Line description
                      <input
                        className={inputClassName}
                        value={line.description}
                        onChange={(event) =>
                          updateLine(
                            line.clientId,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="min-w-0 text-xs font-medium text-muted-foreground">
                      Fund
                      <select
                        className={inputClassName}
                        value={line.fundId}
                        onChange={(event) =>
                          updateLine(
                            line.clientId,
                            "fundId",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">No fund</option>
                        {funds.map((fund) => (
                          <option key={fund.id} value={fund.id}>
                            {fund.code} — {fund.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 text-xs font-medium text-muted-foreground">
                      Debit
                      <input
                        aria-describedby={
                          amountError ? amountErrorId : undefined
                        }
                        aria-invalid={Boolean(amountError)}
                        className={`${inputClassName} tabular-nums`}
                        inputMode="decimal"
                        value={line.debit}
                        onChange={(event) =>
                          updateLine(
                            line.clientId,
                            "debit",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="min-w-0 text-xs font-medium text-muted-foreground">
                      Credit
                      <input
                        aria-describedby={
                          amountError ? amountErrorId : undefined
                        }
                        aria-invalid={Boolean(amountError)}
                        className={`${inputClassName} tabular-nums`}
                        inputMode="decimal"
                        value={line.credit}
                        onChange={(event) =>
                          updateLine(
                            line.clientId,
                            "credit",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        aria-label={`Remove journal line ${index + 1}`}
                        className="w-full xl:w-auto"
                        disabled={lines.length <= 2}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (candidate) =>
                                candidate.clientId !== line.clientId,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  {accountError ? (
                    <p
                      className="mt-2 text-sm text-destructive"
                      id={accountErrorId}
                    >
                      {accountError}
                    </p>
                  ) : null}
                  {amountError ? (
                    <p
                      className="mt-1 text-sm text-destructive"
                      id={amountErrorId}
                    >
                      {amountError}
                    </p>
                  ) : null}
                </fieldset>
              );
            })}
          </div>

          <Button
            className="mt-3"
            type="button"
            variant="outline"
            onClick={() => setLines((current) => [...current, createLine()])}
          >
            Add journal line
          </Button>
        </fieldset>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">Total debit</dt>
              <dd className="mt-1 text-sm text-foreground tabular-nums">
                {formatCurrencyFromCents(debitCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total credit</dt>
              <dd className="mt-1 text-sm text-foreground tabular-nums">
                {formatCurrencyFromCents(creditCents)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="sr-only">Balance state</dt>
              <dd
                className={`text-sm font-medium ${balanced && nonzero ? "text-foreground" : "text-destructive"}`}
                role="status"
              >
                {balanced && nonzero ? "Balanced" : "Out of balance"}
              </dd>
            </div>
          </dl>
          <Button disabled={!canSubmit} type="submit">
            {isPending ? "Creating…" : "Create journal entry"}
          </Button>
        </div>

        {isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            Creating journal entry…
          </p>
        ) : null}
        {actionError ? (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}
      </form>
    </section>
  );
}

export {
  createLine,
  formatCurrencyFromCents,
  parseAmount,
  toCurrencyCents,
  validateLine,
};
