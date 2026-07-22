import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("./organization-membership-repository", () => ({
  getUserOrganizationMemberships: vi.fn(),
}));

import { getConfiguredOrganizationId } from "./organization-context";

const originalEnv = process.env;

function setOrganizationId(value?: string) {
  if (value === undefined) {
    delete process.env.PARABLE_ORGANIZATION_ID;
  } else {
    process.env.PARABLE_ORGANIZATION_ID = value;
  }
}

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getConfiguredOrganizationId", () => {
  it("returns the configured organization id", () => {
    setOrganizationId("22222222-2222-4222-8222-222222222222");

    expect(getConfiguredOrganizationId()).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("trims leading and trailing whitespace", () => {
    setOrganizationId("  33333333-3333-4333-8333-333333333333  ");

    expect(getConfiguredOrganizationId()).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("throws when PARABLE_ORGANIZATION_ID is missing", () => {
    setOrganizationId(undefined);

    expect(() => getConfiguredOrganizationId()).toThrow(
      "Missing required environment variable: PARABLE_ORGANIZATION_ID",
    );
  });

  it("throws when PARABLE_ORGANIZATION_ID is blank", () => {
    setOrganizationId("   ");

    expect(() => getConfiguredOrganizationId()).toThrow(
      "Missing required environment variable: PARABLE_ORGANIZATION_ID",
    );
  });

  it("does not produce a fallback organization id", () => {
    setOrganizationId(undefined);

    expect(() => getConfiguredOrganizationId()).toThrow(
      /Missing required environment variable: PARABLE_ORGANIZATION_ID/,
    );
    expect(process.env.PARABLE_ORGANIZATION_ID).toBeUndefined();
  });
});
