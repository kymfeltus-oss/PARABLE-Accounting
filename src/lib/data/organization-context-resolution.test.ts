import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";

vi.mock("server-only", () => ({}));

const {
  getAuthenticatedUserMock,
  getUserOrganizationMembershipsMock,
  getSelectedOrganizationIdMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getUserOrganizationMembershipsMock: vi.fn(),
  getSelectedOrganizationIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("./organization-membership-repository", () => ({
  getUserOrganizationMemberships: getUserOrganizationMembershipsMock,
}));

vi.mock("./organization-selection", () => ({
  getSelectedOrganizationId: getSelectedOrganizationIdMock,
}));

import {
  getCurrentOrganizationId,
  resolveOrganizationContext,
  resolveOrganizationContextForAuthenticatedUser,
} from "./organization-context";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";

describe("organization context resolution", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getUserOrganizationMembershipsMock.mockReset();
    getSelectedOrganizationIdMock.mockReset();
    getSelectedOrganizationIdMock.mockResolvedValue(null);
  });

  it("returns unauthenticated when no user session exists", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(resolveOrganizationContextForAuthenticatedUser()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("returns none when the authenticated user has zero memberships", async () => {
    getUserOrganizationMembershipsMock.mockResolvedValue([]);

    await expect(resolveOrganizationContext(TEST_USER_ID)).resolves.toEqual({
      status: "none",
    });
    expect(getUserOrganizationMembershipsMock).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns resolved organization id for exactly one membership", async () => {
    getUserOrganizationMembershipsMock.mockResolvedValue([
      {
        organizationId: TEST_ORGANIZATION_ID,
        name: "Parable Community Church",
      },
    ]);

    await expect(resolveOrganizationContext(TEST_USER_ID)).resolves.toEqual({
      status: "resolved",
      organizationId: TEST_ORGANIZATION_ID,
    });
  });

  it("returns multiple organizations without selecting one", async () => {
    const organizations = [
      {
        organizationId: TEST_ORGANIZATION_ID,
        name: "Alpha Ministry",
      },
      {
        organizationId: OTHER_ORGANIZATION_ID,
        name: "Zion Fellowship",
      },
    ];
    getUserOrganizationMembershipsMock.mockResolvedValue(organizations);

    await expect(resolveOrganizationContext(TEST_USER_ID)).resolves.toEqual({
      status: "multiple",
      organizations,
    });
  });

  it("returns resolved organization id when preferred selection matches a membership", async () => {
    getUserOrganizationMembershipsMock.mockResolvedValue([
      { organizationId: TEST_ORGANIZATION_ID, name: "Alpha Ministry" },
      { organizationId: OTHER_ORGANIZATION_ID, name: "Zion Fellowship" },
    ]);

    await expect(
      resolveOrganizationContext(TEST_USER_ID, OTHER_ORGANIZATION_ID),
    ).resolves.toEqual({
      status: "resolved",
      organizationId: OTHER_ORGANIZATION_ID,
    });
  });

  it("resolveOrganizationContextForAuthenticatedUser uses cookie-backed preferred organization", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: TEST_USER_ID });
    getSelectedOrganizationIdMock.mockResolvedValue(OTHER_ORGANIZATION_ID);
    getUserOrganizationMembershipsMock.mockResolvedValue([
      { organizationId: TEST_ORGANIZATION_ID, name: "Alpha Ministry" },
      { organizationId: OTHER_ORGANIZATION_ID, name: "Zion Fellowship" },
    ]);

    await expect(resolveOrganizationContextForAuthenticatedUser()).resolves.toEqual({
      status: "resolved",
      organizationId: OTHER_ORGANIZATION_ID,
    });
    expect(getSelectedOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("getCurrentOrganizationId returns the resolved organization id", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: TEST_USER_ID });
    getUserOrganizationMembershipsMock.mockResolvedValue([
      {
        organizationId: TEST_ORGANIZATION_ID,
        name: "Parable Community Church",
      },
    ]);

    await expect(getCurrentOrganizationId()).resolves.toBe(TEST_ORGANIZATION_ID);
  });

  it("getCurrentOrganizationId throws for zero memberships", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: TEST_USER_ID });
    getUserOrganizationMembershipsMock.mockResolvedValue([]);

    await expect(getCurrentOrganizationId()).rejects.toBeInstanceOf(DataAccessError);
  });

  it("getCurrentOrganizationId throws for multiple memberships", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: TEST_USER_ID });
    getUserOrganizationMembershipsMock.mockResolvedValue([
      { organizationId: TEST_ORGANIZATION_ID, name: "Alpha Ministry" },
      { organizationId: OTHER_ORGANIZATION_ID, name: "Zion Fellowship" },
    ]);

    await expect(getCurrentOrganizationId()).rejects.toBeInstanceOf(DataAccessError);
  });

  it("does not accept client-supplied organization ids", () => {
    const contents = readFileSync(
      path.join(import.meta.dirname, "organization-context.ts"),
      "utf8",
    );

    expect(contents).not.toMatch(/searchParams|headers\(|cookies\(/);
    expect(contents).toContain("getUserOrganizationMemberships(userId)");
  });

  it("getCurrentOrganizationId does not use PARABLE_ORGANIZATION_ID fallback", () => {
    const contents = readFileSync(
      path.join(import.meta.dirname, "organization-context.ts"),
      "utf8",
    );
    const start = contents.indexOf("export async function getCurrentOrganizationId()");
    const end = contents.indexOf("export type { UserOrganizationSummary }");
    const functionBody = contents.slice(start, end);

    expect(functionBody).toContain("getCurrentOrganizationId");
    expect(functionBody).not.toContain("getConfiguredOrganizationId");
    expect(functionBody).not.toContain("PARABLE_ORGANIZATION_ID");
  });
});
