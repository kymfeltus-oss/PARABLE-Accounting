"use client";

import { useState, useTransition } from "react";

import { createAccountingPeriodAction } from "@/app/(workspace)/accounting/actions";
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

export function CreateAccountingPeriodForm() {
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

    startTransition(async () => {
      const result = await createAccountingPeriodAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Accounting period "${result.period.name}" created.`);
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
          <Button size="sm" type="button" variant="outline">
            Add Period
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-accounting-period-description">
          <SheetHeader>
            <SheetTitle>Add Accounting Period</SheetTitle>
            <SheetDescription id="create-accounting-period-description">
              Create an open accounting period with a start and end date.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="accounting-period-name"
              >
                Period name
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="accounting-period-name"
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
                htmlFor="accounting-period-start-date"
              >
                Start date
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="accounting-period-start-date"
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
                htmlFor="accounting-period-end-date"
              >
                End date
              </label>
              <input
                className={inputClassName}
                disabled={isPending}
                id="accounting-period-end-date"
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
              {isPending ? "Creating..." : "Create Period"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
