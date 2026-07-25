"use client";

import { useState, useTransition } from "react";

import { createExpenseDraftAction } from "@/app/(workspace)/expenses/actions";
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
import type { ExpensePaymentSource } from "@/lib/data/expenses-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const PAYMENT_SOURCE_OPTIONS: Array<{
  label: string;
  value: ExpensePaymentSource;
}> = [
  { label: "Bank", value: "bank" },
  { label: "Card", value: "card" },
  { label: "Cash", value: "cash" },
  { label: "Reimbursement", value: "reimbursement" },
  { label: "Other", value: "other" },
];

export type ExpenseVendorOption = {
  id: string;
  name: string;
};

type CreateExpenseDraftFormProps = {
  vendorOptions: ExpenseVendorOption[];
  triggerLabel?: string;
  triggerClassName?: string;
};

function parseTotalAmount(value: string): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function mapVendorSelection(value: string): string | null {
  return value === "" ? null : value;
}

function normalizeReference(value: string): string | null {
  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

export function CreateExpenseDraftForm({
  vendorOptions,
  triggerLabel = "New Expense",
  triggerClassName,
}: CreateExpenseDraftFormProps) {
  const [open, setOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentSource, setPaymentSource] =
    useState<ExpensePaymentSource>("other");
  const [vendorId, setVendorId] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setExpenseDate("");
    setDescription("");
    setTotalAmount("");
    setPaymentSource("other");
    setVendorId("");
    setReference("");
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

    const trimmedDescription = description.trim();
    const trimmedExpenseDate = expenseDate.trim();

    if (trimmedExpenseDate === "") {
      setError("Expense date is required.");
      return;
    }

    if (trimmedDescription === "") {
      setError("Expense description is required.");
      return;
    }

    const parsedTotalAmount = parseTotalAmount(totalAmount);

    if (parsedTotalAmount === null) {
      setError(
        "Unable to create expense draft. Please verify the information and try again.",
      );
      return;
    }

    startTransition(async () => {
      const result = await createExpenseDraftAction({
        expenseDate: trimmedExpenseDate,
        description: trimmedDescription,
        totalAmount: parsedTotalAmount,
        vendorId: mapVendorSelection(vendorId),
        reference: normalizeReference(reference),
        paymentSource,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setSuccessMessage(`Draft expense "${trimmedDescription}" created.`);
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
          <Button type="button" className={triggerClassName}>
            {triggerLabel === "Record expense" ? (
              <Plus aria-hidden className="size-4" />
            ) : null}
            {triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-expense-draft-description">
          <SheetHeader>
            <SheetTitle>New Expense</SheetTitle>
            <SheetDescription id="create-expense-draft-description">
              Create a draft expense header. Allocation lines, recording, and
              journal posting are handled separately.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="expense-date"
              >
                Expense date
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="expense-date"
                name="expenseDate"
                required
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="expense-description"
              >
                Description
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="expense-description"
                name="description"
                required
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="expense-total-amount"
              >
                Total amount
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="expense-total-amount"
                inputMode="decimal"
                min="0.01"
                name="totalAmount"
                required
                step="0.01"
                type="number"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="expense-payment-source"
              >
                Payment source
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="expense-payment-source"
                name="paymentSource"
                required
                value={paymentSource}
                onChange={(event) =>
                  setPaymentSource(event.target.value as ExpensePaymentSource)
                }
              >
                {PAYMENT_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="expense-vendor"
              >
                Vendor
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="expense-vendor"
                name="vendorId"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
              >
                <option value="">No vendor</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="expense-reference"
              >
                Reference
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="expense-reference"
                name="reference"
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Draft Expense"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export {
  mapVendorSelection,
  normalizeReference,
  parseTotalAmount,
  PAYMENT_SOURCE_OPTIONS,
};
