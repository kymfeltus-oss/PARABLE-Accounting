import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

import { DataAccessError } from "./data-access-error";
import {
  getUserOrganizationMemberships,
  type UserOrganizationSummary,
} from "./organization-membership-repository";

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

  return resolveOrganizationContext(user.id);
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
