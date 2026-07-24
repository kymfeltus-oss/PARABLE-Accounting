"use client";

import { useState, useTransition } from "react";

import { createBudgetAction } from "@/app/(workspace)/budgets/actions";
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

export function CreateBudgetForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setName("");
    setStartDate("");
    setEndDate("");
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
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("status", "draft");

    startTransition(async () => {
      const result = await createBudgetAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Budget "${result.budget.name}" created.`);
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
          <Button type="button">Create Budget</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-budget-description">
          <SheetHeader>
            <SheetTitle>Create Budget</SheetTitle>
            <SheetDescription id="create-budget-description">
              Add a draft budget period for expense and revenue planning.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="budget-name"
              >
                Budget name
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="budget-name"
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
                htmlFor="budget-start-date"
              >
                Start date
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="budget-start-date"
                name="startDate"
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="budget-end-date"
              >
                End date
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="budget-end-date"
                name="endDate"
                required
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Budget"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
