"use client";

import { useState, useTransition } from "react";

import { updateMemberAction } from "@/app/(workspace)/members/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MemberRow } from "@/lib/data/types/rows";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type EditMemberFormProps = {
  member: MemberRow;
};

function formatMemberName(member: MemberRow): string {
  return `${member.first_name} ${member.last_name}`.trim();
}

export function EditMemberForm({ member }: EditMemberFormProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [email, setEmail] = useState(member.email ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [status, setStatus] = useState(member.status);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setFirstName(member.first_name);
      setLastName(member.last_name);
      setEmail(member.email ?? "");
      setPhone(member.phone ?? "");
      setStatus(member.status);
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
    formData.set("memberId", member.id);
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("status", status);

    startTransition(async () => {
      const result = await updateMemberAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(
        `Member "${formatMemberName(result.member)}" updated.`,
      );
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
        <SheetContent aria-describedby={`edit-member-description-${member.id}`}>
          <SheetHeader>
            <SheetTitle>Edit Member</SheetTitle>
            <SheetDescription id={`edit-member-description-${member.id}`}>
              Update member details for {formatMemberName(member)}.
            </SheetDescription>
          </SheetHeader>

          <form className="space-y-4 px-4" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor={`edit-member-first-name-${member.id}`}
              >
                First name
              </label>
              <input
                autoComplete="given-name"
                className={inputClassName}
                disabled={isPending}
                id={`edit-member-first-name-${member.id}`}
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
                htmlFor={`edit-member-last-name-${member.id}`}
              >
                Last name
              </label>
              <input
                autoComplete="family-name"
                className={inputClassName}
                disabled={isPending}
                id={`edit-member-last-name-${member.id}`}
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
                htmlFor={`edit-member-email-${member.id}`}
              >
                Email
              </label>
              <input
                autoComplete="email"
                className={inputClassName}
                disabled={isPending}
                id={`edit-member-email-${member.id}`}
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor={`edit-member-phone-${member.id}`}
              >
                Phone
              </label>
              <input
                autoComplete="tel"
                className={inputClassName}
                disabled={isPending}
                id={`edit-member-phone-${member.id}`}
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor={`edit-member-status-${member.id}`}
              >
                Status
              </label>
              <select
                className={inputClassName}
                disabled={isPending}
                id={`edit-member-status-${member.id}`}
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
              {isPending ? "Saving..." : "Save Member"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export type { EditMemberFormProps };
