import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type {
  OrganizationMembershipRow,
  OrganizationRow,
} from "./types/rows";

export type OrganizationMembershipRole =
  | "owner"
  | "accountant"
  | "staff"
  | "viewer";

const ORGANIZATION_MEMBERSHIP_ROLES: readonly OrganizationMembershipRole[] = [
  "owner",
  "accountant",
  "staff",
  "viewer",
];

function requireMembershipRole(
  role: string,
  operation: string,
): OrganizationMembershipRole {
  if (
    !ORGANIZATION_MEMBERSHIP_ROLES.includes(role as OrganizationMembershipRole)
  ) {
    throw new DataAccessError({
      operation,
      message: "Membership role is invalid for the authenticated user",
    });
  }

  return role as OrganizationMembershipRole;
}

export type SettingsData = {
  organizationId: string;
  organization: OrganizationRow;
  currentUserRole: OrganizationMembershipRole;
  memberships: OrganizationMembershipRow[];
  counts: {
    totalMemberships: number;
  };
};

export async function getSettingsData(
  organizationId: string,
): Promise<SettingsData> {
  const operation = "getSettingsData";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new DataAccessError({
      operation: `${operation}.auth`,
      message: "Authenticated user is required",
    });
  }

  const supabase = await createServerSupabaseClient();

  const [organizationResult, membershipsResult, currentMembershipResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("*")
        .eq("id", scopedOrganizationId),
      supabase
        .from("organization_memberships")
        .select("*")
        .eq("organization_id", scopedOrganizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_memberships")
        .select("role")
        .eq("organization_id", scopedOrganizationId)
        .eq("user_id", user.id),
    ]);

  if (organizationResult.error) {
    throw toDataAccessError(
      "getSettingsData.organization",
      organizationResult.error,
    );
  }

  const organizationRows = (organizationResult.data ?? []) as OrganizationRow[];

  if (organizationRows.length === 0) {
    throw new DataAccessError({
      operation: "getSettingsData.organization",
      message: "Organization not found for the configured organization id",
    });
  }

  const memberships = unwrapRows<OrganizationMembershipRow>(
    "getSettingsData.memberships",
    membershipsResult,
  );

  if (currentMembershipResult.error) {
    throw toDataAccessError(
      "getSettingsData.currentMembership",
      currentMembershipResult.error,
    );
  }

  const currentMembershipRows = (currentMembershipResult.data ??
    []) as Array<{ role: string }>;

  if (currentMembershipRows.length === 0) {
    throw new DataAccessError({
      operation: "getSettingsData.currentMembership",
      message: "Authenticated user membership was not found for the organization",
    });
  }

  const currentUserRole = requireMembershipRole(
    currentMembershipRows[0].role,
    "getSettingsData.currentMembership",
  );

  return {
    organizationId: scopedOrganizationId,
    organization: organizationRows[0],
    currentUserRole,
    memberships,
    counts: {
      totalMemberships: memberships.length,
    },
  };
}
