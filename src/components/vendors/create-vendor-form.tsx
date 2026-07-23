"use client";

import { useState, useTransition } from "react";

import { createVendorAction } from "@/app/(workspace)/vendors/actions";
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

function sanitizeTaxIdLastFour(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function CreateVendorForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxIdLastFour, setTaxIdLastFour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setName("");
    setEmail("");
    setPhone("");
    setTaxIdLastFour("");
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
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("taxIdLastFour", taxIdLastFour);

    startTransition(async () => {
      const result = await createVendorAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Vendor "${result.vendor.name}" created.`);
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
          <Button type="button">Add Vendor</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-vendor-description">
          <SheetHeader>
            <SheetTitle>Add Vendor</SheetTitle>
            <SheetDescription id="create-vendor-description">
              Create a vendor profile for bills and expenses. Only the last four
              digits of a tax identifier may be stored.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="vendor-name"
              >
                Vendor name
              </label>
              <input
                autoComplete="organization"
                className={inputClassName}
                disabled={isPending}
                id="vendor-name"
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
                htmlFor="vendor-email"
              >
                Email
              </label>
              <input
                autoComplete="email"
                className={inputClassName}
                disabled={isPending}
                id="vendor-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="vendor-phone"
              >
                Phone
              </label>
              <input
                autoComplete="tel"
                className={inputClassName}
                disabled={isPending}
                id="vendor-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="vendor-tax-id-last-four"
              >
                Tax ID last four
              </label>
              <input
                autoComplete="off"
                className={inputClassName}
                disabled={isPending}
                id="vendor-tax-id-last-four"
                inputMode="numeric"
                maxLength={4}
                name="taxIdLastFour"
                pattern="[0-9]{4}"
                type="text"
                value={taxIdLastFour}
                onChange={(event) =>
                  setTaxIdLastFour(sanitizeTaxIdLastFour(event.target.value))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Enter exactly four digits when provided.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Vendor"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { sanitizeTaxIdLastFour };
