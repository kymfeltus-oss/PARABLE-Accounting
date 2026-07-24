"use client";

import { useState, useTransition } from "react";

import { createBankTransactionAction } from "@/app/(workspace)/banking/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { BankAccountOption } from "@/lib/data/transactions-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const TRANSACTION_TYPE_OPTIONS = [
  { value: "inbound", label: "Inbound (deposit)" },
  { value: "outbound", label: "Outbound (payment)" },
] as const;

type CreateBankTransactionFormProps = {
  bankAccounts: BankAccountOption[];
  triggerLabel?: string;
};

export function CreateBankTransactionForm({
  bankAccounts,
  triggerLabel = "Add Transaction",
}: CreateBankTransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionType, setTransactionType] = useState("inbound");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setBankAccountId("");
    setTransactionDate("");
    setAmount("");
    setDescription("");
    setTransactionType("inbound");
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

    const formData = new FormData();
    formData.set("bankAccountId", bankAccountId);
    formData.set("transactionDate", transactionDate);
    formData.set("amount", amount);
    formData.set("description", description);
    formData.set("transactionType", transactionType);

    startTransition(async () => {
      const result = await createBankTransactionAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage("Bank transaction created.");
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
          <Button type="button">{triggerLabel}</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-bank-transaction-description">
          <SheetHeader>
            <SheetTitle>Add Bank Transaction</SheetTitle>
            <SheetDescription id="create-bank-transaction-description">
              Record manual bank activity for matching and reconciliation
              review.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-transaction-account"
              >
                Bank account
              </label>
              <select
                className={inputClassName}
                disabled={isPending || bankAccounts.length === 0}
                id="bank-transaction-account"
                name="bankAccountId"
                required
                value={bankAccountId}
                onChange={(event) => setBankAccountId(event.target.value)}
              >
                <option value="">
                  {bankAccounts.length === 0
                    ? "No active bank accounts"
                    : "Select bank account"}
                </option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-transaction-date"
              >
                Transaction date
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="bank-transaction-date"
                name="transactionDate"
                required
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-transaction-type"
              >
                Direction
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="bank-transaction-type"
                name="transactionType"
                value={transactionType}
                onChange={(event) => setTransactionType(event.target.value)}
              >
                {TRANSACTION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-transaction-amount"
              >
                Amount
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="bank-transaction-amount"
                inputMode="decimal"
                min="0.01"
                name="amount"
                required
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-transaction-description"
              >
                Description
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="bank-transaction-description"
                name="description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Transaction"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { TRANSACTION_TYPE_OPTIONS };
