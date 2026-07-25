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

export type CreditAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: "asset" | "liability";
};

export type RecordExpenseResult =
  | {
      success: true;
      expenseId: string;
      status: "recorded";
      journalEntryId: string | null;
    }
  | {
      success: false;
      fieldErrors?: {
        expenseId?: string;
        creditAccountId?: string;
      };
      message: string;
    };

export type RecordExpenseFormProps = {
  expenseId: string;
  expenseDescription: string;
  expenseAmount: number;
  paymentSource: string | null;
  allocationComplete: boolean;
  creditAccounts: CreditAccountOption[];
  defaultCreditAccountId?: string | null;
  onRecord: (input: {
    expenseId: string;
    creditAccountId: string;
  }) => Promise<RecordExpenseResult>;
  onRecorded?: (result: {
    expenseId: string;
    journalEntryId: string | null;
  }) => void;
};

function resolveInitialCreditAccountId(
  creditAccounts: CreditAccountOption[],
  defaultCreditAccountId: string | null | undefined,
): string {
  if (
    defaultCreditAccountId &&
    creditAccounts.some((account) => account.id === defaultCreditAccountId)
  ) {
    return defaultCreditAccountId;
  }

  return "";
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function RecordExpenseForm({
  expenseId,
  expenseDescription,
  expenseAmount,
  paymentSource,
  allocationComplete,
  creditAccounts,
  defaultCreditAccountId = null,
  onRecord,
  onRecorded,
}: RecordExpenseFormProps) {
  const [creditAccountId, setCreditAccountId] = useState(() =>
    resolveInitialCreditAccountId(creditAccounts, defaultCreditAccountId),
  );
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recordedResult, setRecordedResult] = useState<{
    expenseId: string;
    journalEntryId: string | null;
  } | null>(null);

  const formattedAmount = currencyFormatter.format(expenseAmount);
  const selectedAccount = useMemo(
    () => creditAccounts.find((account) => account.id === creditAccountId),
    [creditAccountId, creditAccounts],
  );
  const hasAccounts = creditAccounts.length > 0;
  const canConfirm =
    allocationComplete &&
    hasAccounts &&
    Boolean(selectedAccount) &&
    !isPending &&
    !recordedResult;

  function openConfirmation() {
    setAccountError(null);
    setActionError(null);

    if (!creditAccountId || !selectedAccount) {
      setAccountError("Select an eligible payment account.");
      return;
    }

    if (!allocationComplete || !hasAccounts || recordedResult) {
      return;
    }

    setConfirmationOpen(true);
  }

  async function recordExpense() {
    if (isPending || !canConfirm || !selectedAccount) {
      return;
    }

    setIsPending(true);
    setAccountError(null);
    setActionError(null);

    try {
      const result = await onRecord({
        expenseId,
        creditAccountId: selectedAccount.id,
      });

      if (!result.success) {
        setAccountError(result.fieldErrors?.creditAccountId ?? null);
        setActionError(result.fieldErrors?.expenseId ?? result.message);
        setIsPending(false);
        return;
      }

      const successResult = {
        expenseId: result.expenseId,
        journalEntryId: result.journalEntryId,
      };
      setRecordedResult(successResult);
      setConfirmationOpen(false);
      setIsPending(false);
      onRecorded?.(successResult);
    } catch {
      setActionError("Unable to record this expense. Please try again.");
      setIsPending(false);
    }
  }

  if (recordedResult) {
    return (
      <section
        aria-labelledby="record-expense-success-title"
        className="rounded-lg border border-border bg-card p-5"
      >
        <h2
          id="record-expense-success-title"
          className="text-base font-semibold text-foreground"
        >
          Expense recorded
        </h2>
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {expenseDescription} for{" "}
          <span className="tabular-nums text-foreground">{formattedAmount}</span>{" "}
          was recorded successfully.
        </p>
      </section>
    );
  }

  const statusMessage = !allocationComplete
    ? "Complete the expense allocation before recording."
    : !hasAccounts
      ? "No eligible payment accounts are available."
      : "Recording creates the accounting entry for this expense using the selected payment account.";

  return (
    <section
      aria-labelledby="record-expense-title"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="space-y-1">
        <h2
          id="record-expense-title"
          className="text-base font-semibold text-foreground"
        >
          Record expense
        </h2>
        <p className="text-sm text-muted-foreground">
          Review the draft and choose the account that paid for it.
        </p>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </dt>
          <dd className="mt-1 text-sm text-foreground">{expenseDescription}</dd>
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
            Payment source
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {paymentSource || "Not specified"}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="record-expense-credit-account"
        >
          Payment / credit account
        </label>
        <select
          id="record-expense-credit-account"
          aria-describedby={[
            "record-expense-status",
            accountError ? "record-expense-account-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={Boolean(accountError)}
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allocationComplete || !hasAccounts || isPending}
          value={creditAccountId}
          onChange={(event) => {
            setCreditAccountId(event.target.value);
            setAccountError(null);
            setActionError(null);
          }}
        >
          <option value="">Select an eligible account</option>
          {creditAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} — {account.name}
            </option>
          ))}
        </select>
        {accountError && !confirmationOpen ? (
          <p
            className="mt-2 text-sm text-destructive"
            id="record-expense-account-error"
            role="alert"
          >
            {accountError}
          </p>
        ) : null}
      </div>

      <p
        className="mt-3 text-sm text-muted-foreground"
        id="record-expense-status"
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
        <Button
          type="button"
          disabled={!canConfirm}
          onClick={openConfirmation}
        >
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
            <SheetTitle>Confirm expense recording</SheetTitle>
            <SheetDescription>
              Record{" "}
              <span className="tabular-nums text-foreground">
                {formattedAmount}
              </span>{" "}
              for {expenseDescription} to{" "}
              <span className="text-foreground">
                {selectedAccount
                  ? `${selectedAccount.code} — ${selectedAccount.name}`
                  : "the selected account"}
              </span>
              ? This action will create the accounting entry for the expense.
            </SheetDescription>
          </SheetHeader>

          {accountError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {accountError}
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
            <Button
              type="button"
              disabled={isPending}
              onClick={recordExpense}
            >
              {isPending ? "Recording…" : "Record expense"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
