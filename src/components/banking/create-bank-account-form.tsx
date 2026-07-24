"use client";

import { useState, useTransition } from "react";

import { createBankAccountAction } from "@/app/(workspace)/banking/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AssetAccountOption } from "@/lib/data/banking-repository";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "money_market", label: "Money market" },
] as const;

type CreateBankAccountFormProps = {
  assetAccounts: AssetAccountOption[];
};

export function CreateBankAccountForm({
  assetAccounts,
}: CreateBankAccountFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setName("");
    setAccountId("");
    setInstitutionName("");
    setAccountType("checking");
    setLastFour("");
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
    formData.set("name", name);
    formData.set("accountId", accountId);
    formData.set("institutionName", institutionName);
    formData.set("accountType", accountType);
    formData.set("lastFour", lastFour);

    startTransition(async () => {
      const result = await createBankAccountAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Bank account "${result.bankAccount.name}" created.`);
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
          <Button type="button">Add Bank Account</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-bank-account-description">
          <SheetHeader>
            <SheetTitle>Add Bank Account</SheetTitle>
            <SheetDescription id="create-bank-account-description">
              Link a ministry bank account to an active posting asset account
              from the chart.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-account-name"
              >
                Account name
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="bank-account-name"
                name="name"
                required
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-account-chart-account"
              >
                Chart account
              </label>
              <select
                className={inputClassName}
                disabled={isPending || assetAccounts.length === 0}
                id="bank-account-chart-account"
                name="accountId"
                required
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">
                  {assetAccounts.length === 0
                    ? "No active posting asset accounts"
                    : "Select chart account"}
                </option>
                {assetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-account-institution"
              >
                Institution
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="bank-account-institution"
                name="institutionName"
                type="text"
                value={institutionName}
                onChange={(event) => setInstitutionName(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-account-type"
              >
                Account type
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="bank-account-type"
                name="accountType"
                value={accountType}
                onChange={(event) => setAccountType(event.target.value)}
              >
                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="bank-account-last-four"
              >
                Last four digits
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="bank-account-last-four"
                inputMode="numeric"
                maxLength={4}
                name="lastFour"
                pattern="[0-9]{4}"
                type="text"
                value={lastFour}
                onChange={(event) => setLastFour(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Bank Account"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { ACCOUNT_TYPE_OPTIONS };
