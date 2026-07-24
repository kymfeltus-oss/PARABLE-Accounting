import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

import { DataAccessError } from "./data-access-error";
import {
  getUserOrganizationMemberships,
  type UserOrganizationSummary,
} from "./organization-membership-repository";
import { getSelectedOrganizationId } from "./organization-selection";

const PARABLE_ORGANIZATION_ID_ENV = "PARABLE_ORGANIZATION_ID";

export type OrganizationResolution =
  | { status: "unauthenticated" }
  | { status: "resolved"; organizationId: string }
  | { status: "none" }
  | { status: "multiple"; organizations: UserOrganizationSummary[] };

export function getConfiguredOrganizationId(): string {
  const organizationId = process.env[PARABLE_ORGANIZATION_ID_ENV]?.trim();

  if (!organizationId) {
    throw new Error(
      `Missing required environment variable: ${PARABLE_ORGANIZATION_ID_ENV}`,
    );
  }

  return organizationId;
}

export async function resolveOrganizationContext(
  userId: string,
  preferredOrganizationId?: string | null,
): Promise<Exclude<OrganizationResolution, { status: "unauthenticated" }>> {
  const memberships = await getUserOrganizationMemberships(userId);

  if (memberships.length === 0) {
    return { status: "none" };
  }

  if (memberships.length === 1) {
    return {
      status: "resolved",
      organizationId: memberships[0].organizationId,
    };
  }

  const preferred = preferredOrganizationId?.trim() ?? null;

  if (
    preferred &&
    memberships.some((membership) => membership.organizationId === preferred)
  ) {
    return {
      status: "resolved",
      organizationId: preferred,
    };
  }

  return {
    status: "multiple",
    organizations: memberships,
  };
}

export async function resolveOrganizationContextForAuthenticatedUser(): Promise<OrganizationResolution> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const preferredOrganizationId = await getSelectedOrganizationId();
  return resolveOrganizationContext(user.id, preferredOrganizationId);
}

export async function getCurrentOrganizationId(): Promise<string> {
  const resolution = await resolveOrganizationContextForAuthenticatedUser();

  if (resolution.status === "unauthenticated") {
    throw new DataAccessError({
      operation: "getCurrentOrganizationId.auth",
      message: "Authenticated user is required to resolve organization context",
    });
  }

  if (resolution.status === "none") {
    throw new DataAccessError({
      operation: "getCurrentOrganizationId.membership",
      message: "Authenticated user is not assigned to an organization",
    });
  }

  if (resolution.status === "multiple") {
    throw new DataAccessError({
      operation: "getCurrentOrganizationId.membership",
      message: "Authenticated user belongs to multiple organizations",
    });
  }

  return resolution.organizationId;
}

export type { UserOrganizationSummary };
