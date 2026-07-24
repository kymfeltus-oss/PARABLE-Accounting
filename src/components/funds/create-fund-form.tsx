"use client";

import { useState, useTransition } from "react";

import { createFundAction } from "@/app/(workspace)/funds/actions";
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

const FUND_TYPE_OPTIONS = [
  { value: "unrestricted", label: "Unrestricted" },
  { value: "temporarily_restricted", label: "Temporarily restricted" },
  { value: "permanently_restricted", label: "Permanently restricted" },
] as const;

export function CreateFundForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fundType, setFundType] = useState("unrestricted");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setName("");
    setCode("");
    setFundType("unrestricted");
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
    formData.set("code", code);
    formData.set("fundType", fundType);

    startTransition(async () => {
      const result = await createFundAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Fund "${result.fund.name}" created.`);
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
          <Button type="button">Add Fund</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-fund-description">
          <SheetHeader>
            <SheetTitle>Add Fund</SheetTitle>
            <SheetDescription id="create-fund-description">
              Create a designated fund for giving, expense, and budget
              allocations.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="fund-name"
              >
                Fund name
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="fund-name"
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
                htmlFor="fund-code"
              >
                Fund code
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="fund-code"
                name="code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional short code for reports and allocations.
              </p>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="fund-type"
              >
                Fund type
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id="fund-type"
                name="fundType"
                value={fundType}
                onChange={(event) => setFundType(event.target.value)}
              >
                {FUND_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Fund"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { FUND_TYPE_OPTIONS };
