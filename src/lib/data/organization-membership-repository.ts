import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { toDataAccessError } from "./query-helpers";

export type UserOrganizationSummary = {
  organizationId: string;
  name: string;
};

type MembershipWithOrganizationRow = {
  organization_id: string;
  organizations:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

// Membership lookup uses the authenticated server client; RLS restricts rows to auth.uid().
export async function getUserOrganizationMemberships(
  userId: string,
): Promise<UserOrganizationSummary[]> {
  const scopedUserId = userId.trim();

  if (!scopedUserId) {
    throw new DataAccessError({
      operation: "getUserOrganizationMemberships.userId",
      message: "Authenticated user id is required",
    });
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from("organization_memberships")
    .select("organization_id, organizations(id, name)")
    .eq("user_id", scopedUserId)
    .order("created_at", { ascending: true });

  if (result.error) {
    throw toDataAccessError("getUserOrganizationMemberships", result.error);
  }

  const rows = (result.data ?? []) as MembershipWithOrganizationRow[];

  return rows
    .map((row) => {
      const organization = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;

      if (!organization) {
        throw new DataAccessError({
          operation: "getUserOrganizationMemberships.organization",
          message: "Organization record is missing for a membership row",
        });
      }

      return {
        organizationId: row.organization_id,
        name: organization.name,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
