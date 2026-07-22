import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getUserOrganizationMemberships } from "./organization-membership-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const { createAdminSupabaseClientMock, createServerSupabaseClientMock } =
  vi.hoisted(() => ({
    createAdminSupabaseClientMock: vi.fn(),
    createServerSupabaseClientMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

describe("getUserOrganizationMemberships", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createMockSupabaseClient({
      organization_memberships: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getUserOrganizationMemberships(TEST_USER_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("queries organization_memberships scoped to the authenticated user id", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      organization_memberships: [
        {
          data: [
            {
              organization_id: TEST_ORGANIZATION_ID,
              organizations: {
                id: TEST_ORGANIZATION_ID,
                name: "Parable Community Church",
              },
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getUserOrganizationMemberships(TEST_USER_ID);

    expect(queryLog).toHaveLength(1);
    expect(queryLog[0]?.table).toBe("organization_memberships");
    expect(queryLog[0]?.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["user_id", TEST_USER_ID] },
      ]),
    );
  });

  it("returns one organization summary for a single membership", async () => {
    const { client } = createMockSupabaseClient({
      organization_memberships: [
        {
          data: [
            {
              organization_id: TEST_ORGANIZATION_ID,
              organizations: {
                id: TEST_ORGANIZATION_ID,
                name: "Parable Community Church",
              },
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getUserOrganizationMemberships(TEST_USER_ID)).resolves.toEqual([
      {
        organizationId: TEST_ORGANIZATION_ID,
        name: "Parable Community Church",
      },
    ]);
  });

  it("returns multiple organization summaries sorted by name", async () => {
    const { client } = createMockSupabaseClient({
      organization_memberships: [
        {
          data: [
            {
              organization_id: "33333333-3333-4333-8333-333333333333",
              organizations: {
                id: "33333333-3333-4333-8333-333333333333",
                name: "Zion Fellowship",
              },
            },
            {
              organization_id: TEST_ORGANIZATION_ID,
              organizations: {
                id: TEST_ORGANIZATION_ID,
                name: "Alpha Ministry",
              },
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getUserOrganizationMemberships(TEST_USER_ID)).resolves.toEqual([
      {
        organizationId: TEST_ORGANIZATION_ID,
        name: "Alpha Ministry",
      },
      {
        organizationId: "33333333-3333-4333-8333-333333333333",
        name: "Zion Fellowship",
      },
    ]);
  });

  it("throws DataAccessError when the membership query fails", async () => {
    const { client } = createMockSupabaseClient({
      organization_memberships: [
        {
          data: null,
          error: createBackendError("membership query failed"),
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getUserOrganizationMemberships(TEST_USER_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });

  it("rejects blank user ids", async () => {
    await expect(getUserOrganizationMemberships("   ")).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });
});
