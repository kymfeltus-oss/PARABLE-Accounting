"use client";

import { useState, useTransition } from "react";

import { createMemberAction } from "@/app/(workspace)/members/actions";
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

export function CreateMemberForm() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFormFields() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
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
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("email", email);
    formData.set("phone", phone);

    startTransition(async () => {
      const result = await createMemberAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(
        `Member "${result.member.first_name} ${result.member.last_name}" created.`,
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
          <Button type="button">Add Member</Button>
        </SheetTrigger>
        <SheetContent aria-describedby="create-member-description">
          <SheetHeader>
            <SheetTitle>Add Member</SheetTitle>
            <SheetDescription id="create-member-description">
              Create a member profile for your ministry directory.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="member-first-name"
              >
                First name
              </label>
              <input
                autoComplete="given-name"
                className={inputClassName}
                disabled={isPending}
                id="member-first-name"
                name="firstName"
                required
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="member-last-name"
              >
                Last name
              </label>
              <input
                autoComplete="family-name"
                className={inputClassName}
                disabled={isPending}
                id="member-last-name"
                name="lastName"
                required
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="member-email"
              >
                Email
              </label>
              <input
                autoComplete="email"
                className={inputClassName}
                disabled={isPending}
                id="member-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="member-phone"
              >
                Phone
              </label>
              <input
                autoComplete="tel"
                className={inputClassName}
                disabled={isPending}
                id="member-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Member"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
