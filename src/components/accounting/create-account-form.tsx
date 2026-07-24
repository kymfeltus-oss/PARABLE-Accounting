"use client";

import { useState, useTransition } from "react";

import { createAccountAction } from "@/app/(workspace)/accounting/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "net_asset", label: "Net asset" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
] as const;

export function CreateAccountForm() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("asset");
  const [isPosting, setIsPosting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setCode("");
    setName("");
    setAccountType("asset");
    setIsPosting(true);
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
    formData.set("code", code);
    formData.set("name", name);
    formData.set("accountType", accountType);
    if (isPosting) {
      formData.set("isPosting", "on");
    }

    startTransition(async () => {
      const result = await createAccountAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(
        `Account ${result.account.code} "${result.account.name}" created.`,
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
          <Button type="button">Add Account</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-account-description">
          <SheetHeader>
            <SheetTitle>Add Account</SheetTitle>
            <SheetDescription id="create-account-description">
              Add a chart-of-accounts entry for journal posting.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="account-code"
              >
                Account code
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="account-code"
                name="code"
                required
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="account-name"
              >
                Account name
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="account-name"
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
                htmlFor="account-type"
              >
                Account type
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="account-type"
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

            <div className="flex items-center gap-2 pt-1">
              <input
                checked={isPosting}
                className="size-4 rounded border border-border"
                disabled={isPending}
                id="account-is-posting"
                name="isPosting"
                type="checkbox"
                onChange={(event) => setIsPosting(event.target.checked)}
              />
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="account-is-posting"
              >
                Posting account
              </label>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Account"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { ACCOUNT_TYPE_OPTIONS };
