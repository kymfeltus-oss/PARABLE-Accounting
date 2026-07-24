"use client";

import { useState, useTransition } from "react";

import { upsertBudgetLineAction } from "@/app/(workspace)/budgets/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { BudgetFormAccount, BudgetFormFund, BudgetRecord } from "@/lib/data/budgets-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

type AddBudgetLineFormProps = {
  budgets: BudgetRecord[];
  accounts: BudgetFormAccount[];
  funds: BudgetFormFund[];
};

function formatAccountLabel(account: BudgetFormAccount): string {
  return `${account.code} · ${account.name}`;
}

export function AddBudgetLineForm({
  budgets,
  accounts,
  funds,
}: AddBudgetLineFormProps) {
  const editableBudgets = budgets.filter((budget) => budget.status !== "closed");
  const defaultBudgetId = editableBudgets[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [budgetId, setBudgetId] = useState(defaultBudgetId);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fundId, setFundId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSubmit =
    editableBudgets.length > 0 && accounts.length > 0 && budgetId !== "";

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
    formData.set("budgetId", budgetId);
    formData.set("accountId", accountId);
    formData.set("amount", amount);
    formData.set("fundId", fundId);

    startTransition(async () => {
      const result = await upsertBudgetLineAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage("Budget line saved.");
      setAmount("");
      setOpen(false);
    });
  }

  if (editableBudgets.length === 0 || accounts.length === 0) {
    return null;
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
          <Button disabled={!canSubmit} type="button" variant="outline">
            Add Budget Line
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby="add-budget-line-description">
          <SheetHeader>
            <SheetTitle>Add Budget Line</SheetTitle>
            <SheetDescription id="add-budget-line-description">
              Set a budgeted amount for an expense or revenue account.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="budget-line-budget"
              >
                Budget
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="budget-line-budget"
                name="budgetId"
                required
                value={budgetId}
                onChange={(event) => setBudgetId(event.target.value)}
              >
                {editableBudgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name} ({budget.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="budget-line-account"
              >
                Account
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="budget-line-account"
                name="accountId"
                required
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatAccountLabel(account)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="budget-line-fund"
              >
                Fund
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="budget-line-fund"
                name="fundId"
                value={fundId}
                onChange={(event) => setFundId(event.target.value)}
              >
                <option value="">All funds / not fund-specific</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="budget-line-amount"
              >
                Amount
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="budget-line-amount"
                min="0"
                name="amount"
                required
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={isPending || !canSubmit}
              type="submit"
            >
              {isPending ? "Saving..." : "Save Budget Line"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export type { AddBudgetLineFormProps };
