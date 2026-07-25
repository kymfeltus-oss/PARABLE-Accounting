"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createGivingTransactionAction,
  type CreateGivingTransactionActionInput,
} from "@/app/(workspace)/giving/actions";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { GivingMethod } from "@/lib/data/giving-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const GIVING_FORM_ID = "create-giving-transaction-form";

const GIVING_SHEET_CONTENT_CLASS =
  "!grid h-[100dvh] max-h-[100dvh] !gap-0 !overflow-hidden !p-0 data-[side=right]:!h-[100dvh] data-[side=right]:!max-h-[100dvh] data-[side=right]:!w-full data-[side=right]:!overflow-hidden data-[side=right]:sm:!max-w-md";

const GIVING_SHEET_CONTENT_STYLE = {
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  height: "100dvh",
  maxHeight: "100dvh",
  overflow: "hidden",
} as const;

const GIVING_SHEET_SCROLL_BODY_CLASS =
  "min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch]";

const GIVING_SHEET_FOOTER_CLASS =
  "mt-0 shrink-0 border-t border-border bg-popover p-4";

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
  const router = useRouter();
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
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
  const [recoveryGivingId, setRecoveryGivingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligibleDebitAccounts = useMemo(() => {
    const allowedTypes = resolveDebitAccountTypes(givingMethod);
    return debitAccountOptions.filter((account) =>
      allowedTypes.includes(account.accountType as "asset" | "liability"),
    );
  }, [debitAccountOptions, givingMethod]);

  function scrollToSave() {
    const body = scrollBodyRef.current;

    if (body) {
      body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
    }

    saveButtonRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!recordImmediately) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToSave();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [recordImmediately]);

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
    setRecoveryGivingId(null);

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

      resetFormFields();
      setOpen(false);
      router.refresh();

      if (result.ledgerError) {
        setRecoveryGivingId(result.givingTransactionId);
        setSuccessMessage(
          `Giving was saved, but ledger posting failed: ${result.ledgerError}`,
        );
        return;
      }

      setRecoveryGivingId(null);
      setSuccessMessage(
        result.journalEntryId
          ? "Giving recorded and posted to the ledger."
          : "Giving transaction created.",
      );
    });
  }

  return (
    <div className="space-y-2">
      {successMessage ? (
        <div aria-live="polite" className="space-y-2" role="status">
          <p className="text-sm text-foreground">{successMessage}</p>
          {recoveryGivingId ? (
            <Button asChild size="sm" type="button" variant="outline">
              <Link href={`/giving/${recoveryGivingId}`}>
                Open gift to retry ledger posting
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button type="button">
            <Plus aria-hidden className="size-4" />
            {triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent
          aria-describedby="record-giving-description"
          className={GIVING_SHEET_CONTENT_CLASS}
          style={GIVING_SHEET_CONTENT_STYLE}
        >
          <SheetHeader className="shrink-0 border-b border-border">
            <SheetTitle>Record giving</SheetTitle>
            <SheetDescription id="record-giving-description">
              Create a giving transaction. Optionally post it to the ledger
              immediately.
            </SheetDescription>
          </SheetHeader>

          <div
            ref={scrollBodyRef}
            className={GIVING_SHEET_SCROLL_BODY_CLASS}
            data-giving-sheet-scroll-body
          >
            <form
              className="space-y-4"
              id={GIVING_FORM_ID}
              onSubmit={handleSubmit}
            >
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
                        onChange={(event) =>
                          setDebitAccountId(event.target.value)
                        }
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
                        onChange={(event) =>
                          setCreditAccountId(event.target.value)
                        }
                      >
                        <option value="">Select revenue account</option>
                        {revenueAccountOptions.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      className="w-full"
                      type="button"
                      variant="outline"
                      onClick={scrollToSave}
                    >
                      <ChevronDown aria-hidden className="size-4" />
                      Scroll to bottom
                    </Button>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          </div>

          <SheetFooter className={GIVING_SHEET_FOOTER_CLASS}>
            <Button
              ref={saveButtonRef}
              className="w-full"
              disabled={isPending}
              form={GIVING_FORM_ID}
              type="submit"
            >
              {isPending ? "Saving…" : "Save giving"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
