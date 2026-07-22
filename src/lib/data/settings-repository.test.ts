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

function createOrganizationResponse(organization: OrganizationRow) {
  return { data: [organization], error: null };
}

function createEmptySettingsMockClient() {
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
    organization_memberships: [{ data: [], error: null }],
  });
}

describe("getSettingsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getSettingsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptySettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getSettingsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptySettingsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getSettingsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(2);
    expect(queryLog[0].table).toBe("organizations");
    expect(queryLog[1].table).toBe("organization_memberships");
    expect(
      queryLog[0].filters.some(
        (filter) =>
          filter.method === "eq" &&
          filter.args[0] === "id" &&
          filter.args[1] === TEST_ORGANIZATION_ID,
      ),
    ).toBe(true);
    expect(hasOrganizationFilter(queryLog[1], TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("maps organization and membership fields from schema-backed rows", async () => {
    const { client } = createMockSupabaseClient({
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
              user_id: "11111111-1111-4111-8111-111111111111",
              created_at: "2026-02-01T09:00:00.000Z",
              updated_at: "2026-02-01T09:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
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
      user_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-02-01T09:00:00.000Z",
      updated_at: "2026-02-01T09:00:00.000Z",
    });
  });

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
              user_id: "11111111-1111-4111-8111-111111111111",
              created_at: "2026-02-01T09:00:00.000Z",
              updated_at: "2026-02-01T09:00:00.000Z",
            },
            {
              id: "membership-2",
              organization_id: TEST_ORGANIZATION_ID,
              user_id: "22222222-2222-4222-8222-222222222222",
              created_at: "2026-03-01T09:00:00.000Z",
              updated_at: "2026-03-01T09:00:00.000Z",
            },
          ],
          error: null,
        },
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
  });

  it("throws DataAccessError when the organization query fails", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [{ data: null, error: createBackendError("organizations failed") }],
      organization_memberships: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });

  it("throws DataAccessError when the organization record is missing", async () => {
    const { client } = createMockSupabaseClient({
      organizations: [{ data: [], error: null }],
      organization_memberships: [{ data: [], error: null }],
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
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getSettingsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
