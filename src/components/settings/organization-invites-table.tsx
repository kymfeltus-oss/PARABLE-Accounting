"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { revokeOrganizationInviteAction } from "@/app/(workspace)/settings/actions";
import { Button } from "@/components/ui/button";
import type { OrganizationInviteRow } from "@/lib/data/types/rows";

type OrganizationInvitesTableProps = {
  invites: OrganizationInviteRow[];
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function OrganizationInvitesTable({
  invites,
}: OrganizationInvitesTableProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  if (pendingInvites.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No pending invites.
      </p>
    );
  }

  function handleRevoke(inviteId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("inviteId", inviteId);

    startTransition(async () => {
      const result = await revokeOrganizationInviteAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingInvites.map((invite) => (
              <tr key={invite.id} className="border-b border-border/70 align-top">
                <td className="px-3 py-3 text-foreground">
                  {invite.email ?? "—"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {formatRole(invite.role)}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {formatDateTime(invite.expires_at)}
                </td>
                <td className="px-3 py-3">
                  <Button
                    disabled={isPending}
                    onClick={() => handleRevoke(invite.id)}
                    type="button"
                    variant="outline"
                  >
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { OrganizationInvitesTableProps };
