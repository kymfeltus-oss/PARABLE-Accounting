"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { createBillAction } from "@/app/(workspace)/bills/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { BillStatus } from "@/lib/data/bills-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export type BillVendorOption = {
  id: string;
  name: string;
};

export type BillExpenseAccountOption = {
  id: string;
  label: string;
};

export type BillFundOption = {
  id: string;
  label: string;
};

type CreateBillFormProps = {
  vendorOptions?: BillVendorOption[];
  expenseAccountOptions?: BillExpenseAccountOption[];
  fundOptions?: BillFundOption[];
  triggerLabel?: string;
};

function parseTotalAmount(value: string): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function CreateBillForm({
  vendorOptions = [],
  expenseAccountOptions = [],
  fundOptions = [],
  triggerLabel = "New Bill",
}: CreateBillFormProps) {
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [status, setStatus] = useState<BillStatus>("draft");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [fundId, setFundId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setVendorId("");
    setBillDate("");
    setDueDate("");
    setBillNumber("");
    setDescription("");
    setTotalAmount("");
    setStatus("draft");
    setExpenseAccountId("");
    setFundId("");
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

    const trimmedVendorId = vendorId.trim();
    const trimmedBillDate = billDate.trim();
    const parsedTotalAmount = parseTotalAmount(totalAmount);

    if (trimmedVendorId === "") {
      setError("Vendor is required.");
      return;
    }

    if (trimmedBillDate === "") {
      setError("Bill date is required.");
      return;
    }

    if (parsedTotalAmount === null) {
      setError(
        "Unable to create bill. Please verify the information and try again.",
      );
      return;
    }

    startTransition(async () => {
      const result = await createBillAction({
        vendorId: trimmedVendorId,
        billDate: trimmedBillDate,
        totalAmount: parsedTotalAmount,
        billNumber: billNumber.trim() === "" ? null : billNumber.trim(),
        dueDate: dueDate.trim() === "" ? null : dueDate.trim(),
        description: description.trim() === "" ? null : description.trim(),
        status,
        expenseAccountId: expenseAccountId === "" ? null : expenseAccountId,
        fundId: fundId === "" ? null : fundId,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setSuccessMessage("Bill created.");
      resetFormFields();
      setOpen(false);
    });
  }

  const hasVendors = vendorOptions.length > 0;

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
            <SheetTitle>Create bill</SheetTitle>
            <SheetDescription>
              Enter vendor payables details. Optionally add a summary expense
              line.
            </SheetDescription>
          </SheetHeader>

          {!hasVendors ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Bills need a vendor. Create a vendor first, then come back to
                enter the payable.
              </p>
              <Button asChild type="button">
                <Link href="/vendors">Create vendor</Link>
              </Button>
            </div>
          ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium" htmlFor="bill-vendor">
                Vendor
              </label>
              <select
                required
                className={inputClassName}
                id="bill-vendor"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
              >
                <option value="">Select vendor</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-date">
                Bill date
              </label>
              <input
                required
                className={inputClassName}
                id="bill-date"
                type="date"
                value={billDate}
                onChange={(event) => setBillDate(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-due-date">
                Due date
              </label>
              <input
                className={inputClassName}
                id="bill-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-number">
                Bill number
              </label>
              <input
                className={inputClassName}
                id="bill-number"
                type="text"
                value={billNumber}
                onChange={(event) => setBillNumber(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-description">
                Description
              </label>
              <input
                className={inputClassName}
                id="bill-description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-amount">
                Total amount
              </label>
              <input
                required
                className={inputClassName}
                id="bill-amount"
                min="0.01"
                step="0.01"
                type="number"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-status">
                Status
              </label>
              <select
                className={inputClassName}
                id="bill-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as BillStatus)
                }
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
              </select>
            </div>

            <div>
              <label
                className="text-sm font-medium"
                htmlFor="bill-expense-account"
              >
                Expense account (optional summary line)
              </label>
              <select
                className={inputClassName}
                id="bill-expense-account"
                value={expenseAccountId}
                onChange={(event) => setExpenseAccountId(event.target.value)}
              >
                <option value="">No summary line</option>
                {expenseAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="bill-fund">
                Fund (optional)
              </label>
              <select
                className={inputClassName}
                id="bill-fund"
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

            <Button disabled={isPending} type="submit">
              {isPending ? "Saving…" : "Save bill"}
            </Button>
          </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
