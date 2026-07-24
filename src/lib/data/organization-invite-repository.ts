import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import {
  createInviteToken,
  hashInviteToken,
} from "./organization-selection";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type {
  OrganizationInviteRow,
  OrganizationMembershipRow,
} from "./types/rows";

export type InviteRole = "accountant" | "staff" | "viewer";
export type MembershipRole = "owner" | InviteRole;

export type CreateOrganizationInviteInput = {
  role: InviteRole;
  email?: string | null;
  expiresInDays?: number;
};

export type CreatedOrganizationInvite = {
  invite: OrganizationInviteRow;
  token: string;
};

const INVITE_ROLES: readonly InviteRole[] = [
  "accountant",
  "staff",
  "viewer",
];

const MEMBERSHIP_ROLES: readonly MembershipRole[] = [
  "owner",
  "accountant",
  "staff",
  "viewer",
];

function requireInviteRole(role: string, operation: string): InviteRole {
  const normalized = role.trim().toLowerCase();

  if (!INVITE_ROLES.includes(normalized as InviteRole)) {
    throw new DataAccessError({
      operation,
      message: "Invite role is invalid",
    });
  }

  return normalized as InviteRole;
}

function requireMembershipRole(
  role: string,
  operation: string,
): MembershipRole {
  const normalized = role.trim().toLowerCase();

  if (!MEMBERSHIP_ROLES.includes(normalized as MembershipRole)) {
    throw new DataAccessError({
      operation,
      message: "Membership role is invalid",
    });
  }

  return normalized as MembershipRole;
}

export async function listOrganizationInvites(
  organizationId: string,
): Promise<OrganizationInviteRow[]> {
  const operation = "listOrganizationInvites";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase
    .from("organization_invites")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .order("created_at", { ascending: false });

  return unwrapRows<OrganizationInviteRow>(operation, result);
}

export async function createOrganizationInvite(
  organizationId: string,
  input: CreateOrganizationInviteInput,
): Promise<CreatedOrganizationInvite> {
  const operation = "createOrganizationInvite";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const role = requireInviteRole(input.role, operation);
  const { token, tokenHash } = createInviteToken();
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_organization_invite", {
    target_organization_id: scopedOrganizationId,
    invite_role: role,
    invite_token_hash: tokenHash,
    invite_email: input.email?.trim() ? input.email.trim().toLowerCase() : null,
    expires_in_days: input.expiresInDays ?? 14,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Invite creation returned no row",
    });
  }

  return {
    invite: result.data as OrganizationInviteRow,
    token,
  };
}

export async function acceptOrganizationInvite(
  token: string,
): Promise<OrganizationMembershipRow> {
  const operation = "acceptOrganizationInvite";
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new DataAccessError({
      operation,
      message: "Invite token is required",
    });
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("accept_organization_invite", {
    invite_token_hash: hashInviteToken(normalizedToken),
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Invite acceptance returned no row",
    });
  }

  return result.data as OrganizationMembershipRow;
}

export async function revokeOrganizationInvite(
  organizationId: string,
  inviteId: string,
): Promise<OrganizationInviteRow> {
  const operation = "revokeOrganizationInvite";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedInviteId = inviteId.trim();

  if (!scopedInviteId) {
    throw new DataAccessError({
      operation,
      message: "Invite is required",
    });
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("revoke_organization_invite", {
    target_organization_id: scopedOrganizationId,
    target_invite_id: scopedInviteId,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Invite revoke returned no row",
    });
  }

  return result.data as OrganizationInviteRow;
}

export async function updateMembershipRole(
  organizationId: string,
  membershipId: string,
  role: string,
): Promise<OrganizationMembershipRow> {
  const operation = "updateMembershipRole";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedMembershipId = membershipId.trim();
  const nextRole = requireMembershipRole(role, operation);

  if (!scopedMembershipId) {
    throw new DataAccessError({
      operation,
      message: "Membership is required",
    });
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("update_membership_role", {
    target_organization_id: scopedOrganizationId,
    target_membership_id: scopedMembershipId,
    new_role: nextRole,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Membership role update returned no row",
    });
  }

  return result.data as OrganizationMembershipRow;
}
