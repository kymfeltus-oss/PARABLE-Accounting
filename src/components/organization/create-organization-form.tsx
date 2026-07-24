"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOrganizationAction } from "@/app/organization/actions";
import { Button } from "@/components/ui/button";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);

    startTransition(async () => {
      const result = await createOrganizationAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      <div>
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="create-organization-name"
        >
          Ministry name
        </label>
        <input
          autoComplete="organization"
          className={inputClassName}
          disabled={isPending}
          id="create-organization-name"
          name="name"
          placeholder="Grace Community Church"
          required
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          The name your team will see in Parable.
        </p>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="create-organization-slug"
        >
          Ministry web name
        </label>
        <input
          autoComplete="off"
          className={inputClassName}
          disabled={isPending}
          id="create-organization-slug"
          name="slug"
          placeholder="grace-community-church"
          type="text"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. A short website-style name using lowercase letters, numbers,
          and hyphens. Leave blank and we&apos;ll create one from your ministry
          name.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Setting up..." : "Set up my ministry"}
      </Button>
    </form>
  );
}
