import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationRow } from "./types/rows";
import { DataAccessError } from "./data-access-error";
import { getSettingsData } from "./settings-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

const {
  createAdminSupabaseClientMock,
  createServerSupabaseClientMock,
  getAuthenticatedUserMock,
} = vi.hoisted(() => ({
  createAdminSupabaseClientMock: vi.fn(),
  createServerSupabaseClientMock: vi.fn(),
  getAuthenticatedUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

function createOrganizationResponse(organization: OrganizationRow) {
  return { data: [organization], error: null };
}

function createCurrentMembershipResponse(role: string) {
  return { data: [{ role }], error: null };
}

function createEmptySettingsMockClient(currentUserRole = "owner") {
  return createMockSupabaseClient({
    organizations: [
      createOrganizationResponse({
        id: TEST_ORGANIZATION_ID,
        name: "Parable Community Church",
        slug: "parable-community-church",
        status: "active",
        created_at: "2026-01-15T10:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      }),
    ],
    organization_memberships: [
      { data: [], error: null },
      createCurrentMembershipResponse(currentUserRole),
    ],
  });
}

function createPopulatedSettingsMockClient(
  currentUserRole = "owner",
  membershipRole = "owner",
) {
  return createMockSupabaseClient({
    organizations: [
      createOrganizationResponse({
        id: TEST_ORGANIZATION_ID,
        name: "Northside Ministry",
        slug: "northside-ministry",
        status: "inactive",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-07-02T00:00:00.000Z",
      }),
    ],
    organization_memberships: [
      {
        data: [
          {
            id: "membership-1",
            organization_id: TEST_ORGANIZATION_ID,
            user_id: TEST_USER_ID,
            role: membershipRole,
            created_at: "2026-02-01T09:00:00.000Z",
            updated_at: "2026-02-01T09:00:00.000Z",
          },
        ],
        error: null,
      },
      createCurrentMembershipResponse(currentUserRole),
    ],
  });
}

describe("getSettingsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: TEST_USER_ID });
  });

  it("requires organizationId", async () => {
    await expect(getSettingsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptySettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getSettingsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls getAuthenticatedUser to resolve the current membership role", async () => {
    const { client } = createEmptySettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getSettingsData(TEST_ORGANIZATION_ID);

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptySettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getSettingsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(3);
    expect(queryLog[0].table).toBe("organizations");
    expect(queryLog[1].table).toBe("organization_memberships");
    expect(queryLog[2].table).toBe("organization_memberships");
    expect(
      queryLog[0].filters.some(
        (filter) =>
          filter.method === "eq" &&
          filter.args[0] === "id" &&
          filter.args[1] === TEST_ORGANIZATION_ID,
      ),
    ).toBe(true);
    expect(hasOrganizationFilter(queryLog[1], TEST_ORGANIZATION_ID)).toBe(true);
    expect(hasOrganizationFilter(queryLog[2], TEST_ORGANIZATION_ID)).toBe(true);
    expect(
      queryLog[2].filters.some(
        (filter) =>
          filter.method === "eq" &&
          filter.args[0] === "user_id" &&
          filter.args[1] === TEST_USER_ID,
      ),
    ).toBe(true);
  });

  it("maps organization and membership fields from schema-backed rows", async () => {
    const { client } = createPopulatedSettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getSettingsData(TEST_ORGANIZATION_ID);

    expect(result.organization).toEqual({
      id: TEST_ORGANIZATION_ID,
      name: "Northside Ministry",
      slug: "northside-ministry",
      status: "inactive",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-07-02T00:00:00.000Z",
    });
    expect(result.memberships[0]).toEqual({
      id: "membership-1",
      organization_id: TEST_ORGANIZATION_ID,
      user_id: TEST_USER_ID,
      role: "owner",
      created_at: "2026-02-01T09:00:00.000Z",
      updated_at: "2026-02-01T09:00:00.000Z",
    });
    expect(result.currentUserRole).toBe("owner");
  });

  it.each([
    ["owner", "owner"],
    ["accountant", "accountant"],
    ["staff", "staff"],
    ["viewer", "viewer"],
  ] as const)(
    "returns the authenticated user's %s role from organization_memberships",
    async (role, expectedRole) => {
      const { client } = createEmptySettingsMockClient(role);
      createServerSupabaseClientMock.mockResolvedValue(client);

      const result = await getSettingsData(TEST_ORGANIZATION_ID);

      expect(result.currentUserRole).toBe(expectedRole);
    },
  );

  it("counts total memberships using membership row count", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [
        createOrganizationResponse({
          id: TEST_ORGANIZATION_ID,
          name: "Parable Community Church",
          slug: "parable-community-church",
          status: "active",
          created_at: "2026-01-15T10:00:00.000Z",
          updated_at: "2026-07-01T12:00:00.000Z",
        }),
      ],
      organization_memberships: [
        {
          data: [
            {
              id: "membership-1",
              organization_id: TEST_ORGANIZATION_ID,
              user_id: TEST_USER_ID,
              role: "owner",
              created_at: "2026-02-01T09:00:00.000Z",
              updated_at: "2026-02-01T09:00:00.000Z",
            },
            {
              id: "membership-2",
              organization_id: TEST_ORGANIZATION_ID,
              user_id: "22222222-2222-4222-8222-222222222222",
              role: "staff",
              created_at: "2026-03-01T09:00:00.000Z",
              updated_at: "2026-03-01T09:00:00.000Z",
            },
          ],
          error: null,
        },
        createCurrentMembershipResponse("owner"),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getSettingsData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      totalMemberships: 2,
    });
  });

  it("does not expose fabricated preference or configuration values", async () => {
    const { client } = createEmptySettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getSettingsData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("preferences");
    expect(result).not.toHaveProperty("notificationSettings");
    expect(result).not.toHaveProperty("accountingDefaults");
    expect(result).not.toHaveProperty("roles");
    expect(result).not.toHaveProperty("membershipStatuses");
    expect(result).not.toHaveProperty("membershipStatus");
  });

  it("throws DataAccessError when the authenticated user is missing", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("throws DataAccessError when the organization query fails", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [{ data: null, error: createBackendError("organizations failed") }],
      organization_memberships: [
        { data: [], error: null },
        createCurrentMembershipResponse("owner"),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });

  it("throws DataAccessError when the organization record is missing", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [{ data: [], error: null }],
      organization_memberships: [
        { data: [], error: null },
        createCurrentMembershipResponse("owner"),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });

  it("throws DataAccessError when the memberships query fails", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [
        createOrganizationResponse({
          id: TEST_ORGANIZATION_ID,
          name: "Parable Community Church",
          slug: "parable-community-church",
          status: "active",
          created_at: "2026-01-15T10:00:00.000Z",
          updated_at: "2026-07-01T12:00:00.000Z",
        }),
      ],
      organization_memberships: [
        { data: null, error: createBackendError("memberships failed") },
        createCurrentMembershipResponse("owner"),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });

  it("throws DataAccessError when the authenticated user's membership is missing", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [
        createOrganizationResponse({
          id: TEST_ORGANIZATION_ID,
          name: "Parable Community Church",
          slug: "parable-community-church",
          status: "active",
          created_at: "2026-01-15T10:00:00.000Z",
          updated_at: "2026-07-01T12:00:00.000Z",
        }),
      ],
      organization_memberships: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });

  it("throws DataAccessError when the authenticated user's membership role is invalid", async () => {
    const { client } = createEmptySettingsMockClient("admin");
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
