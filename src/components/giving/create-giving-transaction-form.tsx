"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createGivingTransactionAction,
  type CreateGivingTransactionActionInput,
} from "@/app/(workspace)/giving/actions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { GivingMethod } from "@/lib/data/giving-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const GIVING_METHOD_OPTIONS: Array<{ label: string; value: GivingMethod }> = [
  { label: "Cash", value: "cash" },
  { label: "Check", value: "check" },
  { label: "Card", value: "card" },
  { label: "ACH", value: "ach" },
  { label: "Other", value: "other" },
];

export type GivingMemberOption = {
  id: string;
  label: string;
};

export type GivingFundOption = {
  id: string;
  label: string;
};

export type GivingAccountOption = {
  id: string;
  label: string;
  accountType: "asset" | "liability" | "revenue";
};

type CreateGivingTransactionFormProps = {
  memberOptions?: GivingMemberOption[];
  fundOptions?: GivingFundOption[];
  debitAccountOptions?: GivingAccountOption[];
  revenueAccountOptions?: GivingAccountOption[];
  triggerLabel?: string;
};

function parseAmount(value: string): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolveDebitAccountTypes(givingMethod: GivingMethod): Array<"asset" | "liability"> {
  switch (givingMethod) {
    case "cash":
    case "check":
    case "ach":
      return ["asset"];
    case "card":
    case "other":
      return ["asset", "liability"];
    default:
      return [];
  }
}

export function CreateGivingTransactionForm({
  memberOptions = [],
  fundOptions = [],
  debitAccountOptions = [],
  revenueAccountOptions = [],
  triggerLabel = "Record Giving",
}: CreateGivingTransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [transactionDate, setTransactionDate] = useState("");
  const [amount, setAmount] = useState("");
  const [givingMethod, setGivingMethod] = useState<GivingMethod>("other");
  const [memberId, setMemberId] = useState("");
  const [fundId, setFundId] = useState("");
  const [reference, setReference] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [recordImmediately, setRecordImmediately] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligibleDebitAccounts = useMemo(() => {
    const allowedTypes = resolveDebitAccountTypes(givingMethod);
    return debitAccountOptions.filter((account) =>
      allowedTypes.includes(account.accountType as "asset" | "liability"),
    );
  }, [debitAccountOptions, givingMethod]);

  function resetFormFields() {
    setTransactionDate("");
    setAmount("");
    setGivingMethod("other");
    setMemberId("");
    setFundId("");
    setReference("");
    setDebitAccountId("");
    setCreditAccountId("");
    setRecordImmediately(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedDate = transactionDate.trim();
    const parsedAmount = parseAmount(amount);

    if (trimmedDate === "") {
      setError("Transaction date is required.");
      return;
    }

    if (parsedAmount === null) {
      setError(
        "Unable to create giving transaction. Please verify the information and try again.",
      );
      return;
    }

    const payload: CreateGivingTransactionActionInput = {
      transactionDate: trimmedDate,
      amount: parsedAmount,
      givingMethod,
      memberId: memberId === "" ? null : memberId,
      fundId: fundId === "" ? null : fundId,
      reference: reference.trim() === "" ? null : reference.trim(),
      debitAccountId:
        recordImmediately && debitAccountId !== "" ? debitAccountId : null,
      creditAccountId:
        recordImmediately && creditAccountId !== "" ? creditAccountId : null,
    };

    startTransition(async () => {
      const result = await createGivingTransactionAction(payload);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setSuccessMessage(
        result.journalEntryId
          ? "Giving recorded and posted to the ledger."
          : "Giving transaction created.",
      );
      resetFormFields();
      setOpen(false);
    });
  }

  return (
    <div className="space-y-2">
      {successMessage ? (
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          {successMessage}
        </p>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button type="button">
            <Plus aria-hidden className="size-4" />
            {triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record giving</SheetTitle>
            <SheetDescription>
              Create a giving transaction. Optionally post it to the ledger
              immediately.
            </SheetDescription>
          </SheetHeader>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium" htmlFor="giving-date">
                Transaction date
              </label>
              <input
                required
                className={inputClassName}
                id="giving-date"
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="giving-amount">
                Amount
              </label>
              <input
                required
                className={inputClassName}
                id="giving-amount"
                min="0.01"
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="giving-method">
                Giving method
              </label>
              <select
                className={inputClassName}
                id="giving-method"
                value={givingMethod}
                onChange={(event) => {
                  setGivingMethod(event.target.value as GivingMethod);
                  setDebitAccountId("");
                }}
              >
                {GIVING_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="giving-member">
                Member
              </label>
              <select
                className={inputClassName}
                id="giving-member"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">No member selected</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="giving-fund">
                Fund
              </label>
              <select
                className={inputClassName}
                id="giving-fund"
                value={fundId}
                onChange={(event) => setFundId(event.target.value)}
              >
                <option value="">No fund selected</option>
                {fundOptions.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="giving-reference">
                Reference
              </label>
              <input
                className={inputClassName}
                id="giving-reference"
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  checked={recordImmediately}
                  type="checkbox"
                  onChange={(event) => {
                    setRecordImmediately(event.target.checked);
                    if (!event.target.checked) {
                      setDebitAccountId("");
                      setCreditAccountId("");
                    }
                  }}
                />
                Record to ledger immediately
              </label>

              {recordImmediately ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      className="text-sm font-medium"
                      htmlFor="giving-debit-account"
                    >
                      Debit account
                    </label>
                    <select
                      className={inputClassName}
                      id="giving-debit-account"
                      value={debitAccountId}
                      onChange={(event) => setDebitAccountId(event.target.value)}
                    >
                      <option value="">Select debit account</option>
                      {eligibleDebitAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="text-sm font-medium"
                      htmlFor="giving-revenue-account"
                    >
                      Revenue account
                    </label>
                    <select
                      className={inputClassName}
                      id="giving-revenue-account"
                      value={creditAccountId}
                      onChange={(event) => setCreditAccountId(event.target.value)}
                    >
                      <option value="">Select revenue account</option>
                      {revenueAccountOptions.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button disabled={isPending} type="submit">
              {isPending ? "Saving…" : "Save giving"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
