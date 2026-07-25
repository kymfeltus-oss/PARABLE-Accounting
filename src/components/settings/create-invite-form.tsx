"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createOrganizationInviteAction } from "@/app/(workspace)/settings/actions";
import { Button } from "@/components/ui/button";

const inputClassName =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const INVITE_ROLES = [
  { value: "accountant", label: "Accountant" },
  { value: "staff", label: "Staff" },
  { value: "viewer", label: "Viewer" },
] as const;

export function CreateInviteForm() {
  const router = useRouter();
  const [role, setRole] = useState<string>("staff");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatedToken(null);
    setCopyMessage(null);

    const formData = new FormData();
    formData.set("role", role);
    formData.set("email", email);

    startTransition(async () => {
      const result = await createOrganizationInviteAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCreatedToken(result.token);
      setEmail("");
      router.refresh();
    });
  }

  async function handleCopyToken() {
    if (!createdToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdToken);
      setCopyMessage("Invite code copied.");
    } catch {
      setCopyMessage(
        "Unable to copy automatically. Select and copy the invite code manually.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div>
          <label
            className="block text-sm font-medium text-foreground"
            htmlFor="invite-role"
          >
            Role
          </label>
          <select
            className={inputClassName}
            disabled={isPending}
            id="invite-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {INVITE_ROLES.map((inviteRole) => (
              <option key={inviteRole.value} value={inviteRole.value}>
                {inviteRole.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-foreground"
            htmlFor="invite-email"
          >
            Email
          </label>
          <input
            autoComplete="email"
            className={inputClassName}
            disabled={isPending}
            id="invite-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. Just a note for you — they still need the invite code to
            join.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button disabled={isPending} type="submit">
          {isPending ? "Creating..." : "Create invite code"}
        </Button>
      </form>

      {createdToken ? (
        <div
          aria-live="polite"
          className="rounded-lg border border-border bg-muted/30 p-4"
          role="status"
        >
          <p className="text-sm font-medium text-foreground">
            Invite code ready — copy it now
          </p>
          <p className="mt-2 break-all font-mono text-sm text-foreground">
            {createdToken}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Share this invite code with your teammate.</li>
            <li>They sign in (or create an account) at Parable Accounting.</li>
            <li>
              On the Welcome page, they choose{" "}
              <span className="font-medium text-foreground">
                Join with an invite code
              </span>{" "}
              and paste it.
            </li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            This code won&apos;t be shown again after you leave this page.
          </p>
          <Button
            className="mt-3"
            onClick={() => void handleCopyToken()}
            type="button"
            variant="outline"
          >
            Copy invite code
          </Button>
          {copyMessage ? (
            <p className="mt-2 text-sm text-muted-foreground">{copyMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
