"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateMembershipRoleAction } from "@/app/(workspace)/settings/actions";
import { Button } from "@/components/ui/button";
import type { OrganizationMembershipRow } from "@/lib/data/types/rows";

type OrganizationMembershipsTableProps = {
  memberships: OrganizationMembershipRow[];
  canManageRoles?: boolean;
};

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "accountant", label: "Accountant" },
  { value: "staff", label: "Staff" },
  { value: "viewer", label: "Viewer" },
] as const;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRole(role: string): string {
  const match = ROLE_OPTIONS.find((option) => option.value === role);
  return match?.label ?? role.charAt(0).toUpperCase() + role.slice(1);
}

function shortenUserId(userId: string): string {
  if (userId.length <= 12) {
    return userId;
  }

  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export function OrganizationMembershipsTable({
  memberships,
  canManageRoles = false,
}: OrganizationMembershipsTableProps) {
  const router = useRouter();
  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(
    null,
  );
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (memberships.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No organization memberships recorded yet.
      </p>
    );
  }

  function roleFor(membership: OrganizationMembershipRow): string {
    return draftRoles[membership.id] ?? membership.role;
  }

  function handleSaveRole(membership: OrganizationMembershipRow) {
    const nextRole = roleFor(membership);

    if (nextRole === membership.role) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setPendingMembershipId(membership.id);

    const formData = new FormData();
    formData.set("membershipId", membership.id);
    formData.set("role", nextRole);

    startTransition(async () => {
      const result = await updateMembershipRoleAction(formData);
      setPendingMembershipId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMessage(`Updated role to ${formatRole(nextRole)}.`);
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[membership.id];
        return next;
      });
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
      {successMessage ? (
        <p aria-live="polite" className="text-sm text-foreground" role="status">
          {successMessage}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2 font-medium">Last Updated</th>
              {canManageRoles ? (
                <th className="px-3 py-2 font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {memberships.map((membership) => {
              const selectedRole = roleFor(membership);
              const dirty = selectedRole !== membership.role;
              const rowPending =
                isPending && pendingMembershipId === membership.id;

              return (
                <tr
                  key={membership.id}
                  className="border-b border-border/70 align-top"
                >
                  <td className="px-3 py-3 font-medium text-foreground">
                    <span title={membership.user_id}>
                      {shortenUserId(membership.user_id)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {canManageRoles ? (
                      <select
                        aria-label={`Role for ${membership.user_id}`}
                        className="w-full max-w-[10rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                        disabled={rowPending}
                        value={selectedRole}
                        onChange={(event) =>
                          setDraftRoles((current) => ({
                            ...current,
                            [membership.id]: event.target.value,
                          }))
                        }
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatRole(membership.role)
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatDateTime(membership.created_at)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatDateTime(membership.updated_at)}
                  </td>
                  {canManageRoles ? (
                    <td className="px-3 py-3">
                      <Button
                        disabled={!dirty || rowPending}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => handleSaveRole(membership)}
                      >
                        {rowPending ? "Saving..." : "Save role"}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { OrganizationMembershipsTableProps };
