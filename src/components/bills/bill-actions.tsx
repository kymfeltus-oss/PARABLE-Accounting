"use client";

import { useState, useTransition } from "react";

import {
  openBillAction,
  payBillAction,
  voidBillAction,
} from "@/app/(workspace)/bills/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BillRecord } from "@/lib/data/bills-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export type BillPaymentAccountOption = {
  id: string;
  label: string;
};

export type BillPaymentExpenseAccountOption = {
  id: string;
  label: string;
};

export type BillPaymentFundOption = {
  id: string;
  label: string;
};

type BillActionsProps = {
  bill: BillRecord;
  cashAccountOptions: BillPaymentAccountOption[];
  expenseAccountOptions: BillPaymentExpenseAccountOption[];
  fundOptions: BillPaymentFundOption[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function BillActions({
  bill,
  cashAccountOptions,
  expenseAccountOptions,
  fundOptions,
}: BillActionsProps) {
  const [payOpen, setPayOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [fundId, setFundId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canOpen = bill.status === "draft";
  const canPay = bill.status === "open";
  const canVoid = bill.status === "draft" || bill.status === "open";

  function handleOpenBill() {
    setError(null);

    startTransition(async () => {
      const result = await openBillAction({ billId: bill.id });

      if (!result.success) {
        setError(result.message);
      }
    });
  }

  function handleVoidBill() {
    setError(null);

    startTransition(async () => {
      const result = await voidBillAction({ billId: bill.id });

      if (!result.success) {
        setError(result.message);
      }
    });
  }

  function handlePayBill() {
    setError(null);

    const trimmedPaymentDate = paymentDate.trim();

    if (
      trimmedPaymentDate === "" ||
      cashAccountId === "" ||
      expenseAccountId === ""
    ) {
      setError("Payment date, cash account, and expense account are required.");
      return;
    }

    startTransition(async () => {
      const result = await payBillAction({
        billId: bill.id,
        paymentDate: trimmedPaymentDate,
        cashAccountId,
        expenseAccountId,
        fundId: fundId === "" ? null : fundId,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setPayOpen(false);
      setPaymentDate("");
      setCashAccountId("");
      setExpenseAccountId("");
      setFundId("");
    });
  }

  if (!canOpen && !canPay && !canVoid) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {canOpen ? (
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            variant="outline"
            onClick={handleOpenBill}
          >
            Open
          </Button>
        ) : null}

        {canPay ? (
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            onClick={() => {
              setError(null);
              setPayOpen(true);
            }}
          >
            Pay
          </Button>
        ) : null}

        {canVoid ? (
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            variant="destructive"
            onClick={handleVoidBill}
          >
            Void
          </Button>
        ) : null}
      </div>

      {error && !payOpen ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Sheet
        open={payOpen}
        onOpenChange={(nextOpen) => {
          if (!isPending) {
            setPayOpen(nextOpen);
            if (!nextOpen) {
              setError(null);
            }
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Pay bill</SheetTitle>
            <SheetDescription>
              Pay {formatCurrency(Number(bill.total_amount))} for{" "}
              {bill.vendorName ?? "vendor"}.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor={`pay-date-${bill.id}`}>
                Payment date
              </label>
              <input
                required
                className={inputClassName}
                id={`pay-date-${bill.id}`}
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>

            <div>
              <label
                className="text-sm font-medium"
                htmlFor={`pay-cash-${bill.id}`}
              >
                Cash account
              </label>
              <select
                className={inputClassName}
                id={`pay-cash-${bill.id}`}
                value={cashAccountId}
                onChange={(event) => setCashAccountId(event.target.value)}
              >
                <option value="">Select cash account</option>
                {cashAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium"
                htmlFor={`pay-expense-${bill.id}`}
              >
                Expense account
              </label>
              <select
                className={inputClassName}
                id={`pay-expense-${bill.id}`}
                value={expenseAccountId}
                onChange={(event) => setExpenseAccountId(event.target.value)}
              >
                <option value="">Select expense account</option>
                {expenseAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor={`pay-fund-${bill.id}`}>
                Fund
              </label>
              <select
                className={inputClassName}
                id={`pay-fund-${bill.id}`}
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

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              disabled={isPending}
              type="button"
              variant="outline"
              onClick={() => setPayOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="button" onClick={handlePayBill}>
              {isPending ? "Paying…" : "Confirm payment"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
