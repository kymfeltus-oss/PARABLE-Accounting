"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptOrganizationInviteAction } from "@/app/organization/actions";
import { Button } from "@/components/ui/button";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function AcceptInviteForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("token", token);

    startTransition(async () => {
      const result = await acceptOrganizationInviteAction(formData);

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
          htmlFor="accept-invite-token"
        >
          Invite code
        </label>
        <input
          autoComplete="off"
          className={inputClassName}
          disabled={isPending}
          id="accept-invite-token"
          name="token"
          placeholder="Paste the code you were given"
          required
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Ask your ministry admin for an invite code, then paste it here.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Joining..." : "Join ministry"}
      </Button>
    </form>
  );
}
