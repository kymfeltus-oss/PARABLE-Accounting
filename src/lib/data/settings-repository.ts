import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type {
  AccountRow,
  OrganizationInviteRow,
  OrganizationMembershipRow,
  OrganizationRow,
  OrganizationSettingsRow,
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

export type SettingsMembership = OrganizationMembershipRow & {
  displayName: string;
  email: string | null;
  isCurrentUser: boolean;
};

export type SettingsData = {
  organizationId: string;
  organization: OrganizationRow;
  currentUserRole: OrganizationMembershipRole;
  memberships: SettingsMembership[];
  settings: OrganizationSettingsRow | null;
  invites: OrganizationInviteRow[];
  accounts: AccountRow[];
  counts: {
    totalMemberships: number;
  };
};

function shortenUserId(userId: string): string {
  if (userId.length <= 12) {
    return userId;
  }

  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

function enrichMemberships(
  memberships: OrganizationMembershipRow[],
  invites: OrganizationInviteRow[],
  currentUserId: string,
  currentUserEmail: string | null | undefined,
): SettingsMembership[] {
  const emailByAcceptedUserId = new Map<string, string>();

  for (const invite of invites) {
    if (
      invite.accepted_by_user_id &&
      invite.email &&
      invite.email.trim() !== ""
    ) {
      emailByAcceptedUserId.set(invite.accepted_by_user_id, invite.email.trim());
    }
  }

  return memberships.map((membership) => {
    const isCurrentUser = membership.user_id === currentUserId;
    const email = isCurrentUser
      ? (currentUserEmail?.trim() || null)
      : (emailByAcceptedUserId.get(membership.user_id) ?? null);
    const displayName = isCurrentUser
      ? email
        ? `You (${email})`
        : "You"
      : (email ?? shortenUserId(membership.user_id));

    return {
      ...membership,
      displayName,
      email,
      isCurrentUser,
    };
  });
}

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

  const [
    organizationResult,
    membershipsResult,
    currentMembershipResult,
    settingsResult,
    invitesResult,
    accountsResult,
  ] = await Promise.all([
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
    supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("organization_invites")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "active")
      .eq("is_posting", true)
      .order("code", { ascending: true })
      .order("name", { ascending: true }),
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

  if (settingsResult.error) {
    throw toDataAccessError("getSettingsData.settings", settingsResult.error);
  }

  const settingsRows = (settingsResult.data ??
    []) as OrganizationSettingsRow[];

  const invites = unwrapRows<OrganizationInviteRow>(
    "getSettingsData.invites",
    invitesResult,
  );

  const accounts = unwrapRows<AccountRow>(
    "getSettingsData.accounts",
    accountsResult,
  );

  return {
    organizationId: scopedOrganizationId,
    organization: organizationRows[0],
    currentUserRole,
    memberships: enrichMemberships(
      memberships,
      invites,
      user.id,
      user.email,
    ),
    settings: settingsRows[0] ?? null,
    invites,
    accounts,
    counts: {
      totalMemberships: memberships.length,
    },
  };
}
