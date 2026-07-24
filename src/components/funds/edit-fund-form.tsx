"use client";

import { useState, useTransition } from "react";

import { updateFundAction } from "@/app/(workspace)/funds/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { FundRecord } from "@/lib/data/funds-repository";

import { FUND_TYPE_OPTIONS } from "./create-fund-form";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type EditFundFormProps = {
  fund: FundRecord;
};

export function EditFundForm({ fund }: EditFundFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fund.name);
  const [code, setCode] = useState(fund.code ?? "");
  const [fundType, setFundType] = useState(fund.fund_type);
  const [status, setStatus] = useState(fund.status);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setName(fund.name);
      setCode(fund.code ?? "");
      setFundType(fund.fund_type);
      setStatus(fund.status);
    }

    if (!nextOpen) {
      setError(null);
      setSuccessMessage(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set("fundId", fund.id);
    formData.set("name", name);
    formData.set("code", code);
    formData.set("fundType", fundType);
    formData.set("status", status);

    startTransition(async () => {
      const result = await updateFundAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Fund "${result.fund.name}" updated.`);
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
            Edit
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby={`edit-fund-description-${fund.id}`}>
          <SheetHeader>
            <SheetTitle>Edit Fund</SheetTitle>
            <SheetDescription id={`edit-fund-description-${fund.id}`}>
              Update fund details for {fund.name}.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor={`edit-fund-name-${fund.id}`}
              >
                Fund name
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id={`edit-fund-name-${fund.id}`}
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
                htmlFor={`edit-fund-code-${fund.id}`}
              >
                Fund code
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id={`edit-fund-code-${fund.id}`}
                name="code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor={`edit-fund-type-${fund.id}`}
              >
                Fund type
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id={`edit-fund-type-${fund.id}`}
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

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor={`edit-fund-status-${fund.id}`}
              >
                Status
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id={`edit-fund-status-${fund.id}`}
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
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
              {isPending ? "Saving..." : "Save Fund"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export type { EditFundFormProps };
