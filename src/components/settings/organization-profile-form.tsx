"use client";

import { useState, useTransition } from "react";

import { updateOrganizationProfileAction } from "@/app/(workspace)/settings/actions";
import { Button } from "@/components/ui/button";
import type { OrganizationRow } from "@/lib/data/types/rows";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

type OrganizationProfileFormProps = {
  organization: OrganizationRow;
};

export function OrganizationProfileForm({
  organization,
}: OrganizationProfileFormProps) {
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.set("name", name);

    startTransition(async () => {
      const result = await updateOrganizationProfileAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage("Ministry profile updated.");
    });
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <div>
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="organization-profile-name"
        >
          Ministry name
        </label>
        <input
          autoComplete="organization"
          className={inputClassName}
          disabled={isPending}
          id="organization-profile-name"
          name="name"
          required
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">
            Ministry web name
          </dt>
          <dd className="mt-1 text-sm text-foreground">{organization.slug}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Status</dt>
          <dd className="mt-1 text-sm text-foreground">
            {organization.status.replace(/_/g, " ")}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          {successMessage}
        </p>
      ) : null}

      <Button disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

export type { OrganizationProfileFormProps };
