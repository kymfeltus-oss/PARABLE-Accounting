"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type RecordingAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: "asset" | "liability" | "revenue";
};

export type RecordGivingResult =
  | {
      success: true;
      givingTransactionId: string;
      status: "recorded";
      journalEntryId: string | null;
    }
  | {
      success: false;
      fieldErrors?: {
        givingTransactionId?: string;
        debitAccountId?: string;
        creditAccountId?: string;
      };
      message: string;
    };

export type RecordGivingFormProps = {
  givingTransactionId: string;
  transactionLabel: string;
  amount: number;
  givingMethod: string;
  debitAccounts: RecordingAccountOption[];
  revenueAccounts: RecordingAccountOption[];
  defaultDebitAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
  onRecord: (input: {
    givingTransactionId: string;
    debitAccountId: string;
    creditAccountId: string;
  }) => Promise<RecordGivingResult>;
  onRecorded?: (result: {
    givingTransactionId: string;
    journalEntryId: string | null;
  }) => void;
};

function resolveDefaultAccountId(
  accountId: string | null | undefined,
  accounts: RecordingAccountOption[],
): string {
  if (!accountId) {
    return "";
  }

  return accounts.some((account) => account.id === accountId) ? accountId : "";
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMethod(value: string): string {
  return value.replaceAll("_", " ");
}

export function RecordGivingForm({
  givingTransactionId,
  transactionLabel,
  amount,
  givingMethod,
  debitAccounts,
  revenueAccounts,
  defaultDebitAccountId = null,
  defaultRevenueAccountId = null,
  onRecord,
  onRecorded,
}: RecordGivingFormProps) {
  const [debitAccountId, setDebitAccountId] = useState(() =>
    resolveDefaultAccountId(defaultDebitAccountId, debitAccounts),
  );
  const [creditAccountId, setCreditAccountId] = useState(() =>
    resolveDefaultAccountId(defaultRevenueAccountId, revenueAccounts),
  );
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [debitAccountError, setDebitAccountError] = useState<string | null>(null);
  const [creditAccountError, setCreditAccountError] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [recordedResult, setRecordedResult] = useState<{
    givingTransactionId: string;
    journalEntryId: string | null;
  } | null>(null);

  const formattedAmount = currencyFormatter.format(amount);
  const selectedDebitAccount = useMemo(
    () => debitAccounts.find((account) => account.id === debitAccountId),
    [debitAccountId, debitAccounts],
  );
  const selectedCreditAccount = useMemo(
    () => revenueAccounts.find((account) => account.id === creditAccountId),
    [creditAccountId, revenueAccounts],
  );
  const hasAccounts = debitAccounts.length > 0 && revenueAccounts.length > 0;
  const canConfirm =
    hasAccounts &&
    Boolean(selectedDebitAccount) &&
    Boolean(selectedCreditAccount) &&
    !isPending &&
    !recordedResult;

  function openConfirmation() {
    setDebitAccountError(null);
    setCreditAccountError(null);
    setActionError(null);

    if (!debitAccountId || !selectedDebitAccount) {
      setDebitAccountError("Select an eligible debit account.");
    }

    if (!creditAccountId || !selectedCreditAccount) {
      setCreditAccountError("Select an eligible revenue account.");
    }

    if (
      !debitAccountId ||
      !creditAccountId ||
      !selectedDebitAccount ||
      !selectedCreditAccount ||
      !hasAccounts ||
      recordedResult
    ) {
      return;
    }

    setConfirmationOpen(true);
  }

  async function recordGiving() {
    if (
      isPending ||
      !canConfirm ||
      !selectedDebitAccount ||
      !selectedCreditAccount
    ) {
      return;
    }

    setIsPending(true);
    setDebitAccountError(null);
    setCreditAccountError(null);
    setActionError(null);

    try {
      const result = await onRecord({
        givingTransactionId,
        debitAccountId: selectedDebitAccount.id,
        creditAccountId: selectedCreditAccount.id,
      });

      if (!result.success) {
        setDebitAccountError(result.fieldErrors?.debitAccountId ?? null);
        setCreditAccountError(result.fieldErrors?.creditAccountId ?? null);
        setActionError(
          result.fieldErrors?.givingTransactionId ?? result.message,
        );
        setIsPending(false);
        return;
      }

      const successResult = {
        givingTransactionId: result.givingTransactionId,
        journalEntryId: result.journalEntryId,
      };
      setRecordedResult(successResult);
      setConfirmationOpen(false);
      setIsPending(false);
      onRecorded?.(successResult);
    } catch {
      setActionError("Unable to record this giving transaction. Please try again.");
      setIsPending(false);
    }
  }

  if (recordedResult) {
    return (
      <section
        aria-labelledby="record-giving-success-title"
        className="rounded-lg border border-border bg-card p-5"
      >
        <h2
          id="record-giving-success-title"
          className="text-base font-semibold text-foreground"
        >
          Giving recorded to ledger
        </h2>
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {transactionLabel} for{" "}
          <span className="tabular-nums text-foreground">{formattedAmount}</span>{" "}
          was recorded successfully.
        </p>
      </section>
    );
  }

  const statusMessage = !hasAccounts
    ? "No eligible debit or revenue accounts are available."
    : "Recording creates the accounting entry for this giving transaction.";

  return (
    <section
      aria-labelledby="record-giving-title"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="space-y-1">
        <h2
          id="record-giving-title"
          className="text-base font-semibold text-foreground"
        >
          Record giving to ledger
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose the debit and revenue accounts for this gift.
        </p>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Transaction
          </dt>
          <dd className="mt-1 text-sm text-foreground">{transactionLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Amount
          </dt>
          <dd className="mt-1 text-sm tabular-nums text-foreground">
            {formattedAmount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Giving method
          </dt>
          <dd className="mt-1 text-sm text-foreground capitalize">
            {formatMethod(givingMethod)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="record-giving-debit-account"
          >
            Debit account
          </label>
          <select
            id="record-giving-debit-account"
            aria-describedby={[
              "record-giving-status",
              debitAccountError ? "record-giving-debit-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={Boolean(debitAccountError)}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasAccounts || isPending}
            value={debitAccountId}
            onChange={(event) => {
              setDebitAccountId(event.target.value);
              setDebitAccountError(null);
              setActionError(null);
            }}
          >
            <option value="">Select a debit account</option>
            {debitAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </select>
          {debitAccountError && !confirmationOpen ? (
            <p
              className="mt-2 text-sm text-destructive"
              id="record-giving-debit-error"
              role="alert"
            >
              {debitAccountError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="record-giving-credit-account"
          >
            Revenue account
          </label>
          <select
            id="record-giving-credit-account"
            aria-describedby={[
              "record-giving-status",
              creditAccountError ? "record-giving-credit-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={Boolean(creditAccountError)}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasAccounts || isPending}
            value={creditAccountId}
            onChange={(event) => {
              setCreditAccountId(event.target.value);
              setCreditAccountError(null);
              setActionError(null);
            }}
          >
            <option value="">Select a revenue account</option>
            {revenueAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </select>
          {creditAccountError && !confirmationOpen ? (
            <p
              className="mt-2 text-sm text-destructive"
              id="record-giving-credit-error"
              role="alert"
            >
              {creditAccountError}
            </p>
          ) : null}
        </div>
      </div>

      <p
        className="mt-3 text-sm text-muted-foreground"
        id="record-giving-status"
        role="status"
      >
        {statusMessage}
      </p>

      {actionError && !confirmationOpen ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button type="button" disabled={!canConfirm} onClick={openConfirmation}>
          Review and record
        </Button>
      </div>

      <Sheet
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!isPending) {
            setConfirmationOpen(open);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Confirm giving recording</SheetTitle>
            <SheetDescription>
              Record{" "}
              <span className="tabular-nums text-foreground">
                {formattedAmount}
              </span>{" "}
              for {transactionLabel} with debit{" "}
              <span className="text-foreground">
                {selectedDebitAccount
                  ? `${selectedDebitAccount.code} — ${selectedDebitAccount.name}`
                  : "the selected account"}
              </span>{" "}
              and revenue{" "}
              <span className="text-foreground">
                {selectedCreditAccount
                  ? `${selectedCreditAccount.code} — ${selectedCreditAccount.name}`
                  : "the selected account"}
              </span>
              ?
            </SheetDescription>
          </SheetHeader>

          {debitAccountError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {debitAccountError}
            </p>
          ) : null}
          {creditAccountError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {creditAccountError}
            </p>
          ) : null}
          {actionError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={isPending} onClick={recordGiving}>
              {isPending ? "Recording…" : "Record giving"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
