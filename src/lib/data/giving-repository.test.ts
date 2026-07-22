import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getGivingData } from "./giving-repository";
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

function createEmptyGivingMockClient() {
  return createMockSupabaseClient({
    giving_transactions: [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ],
    funds: [{ data: [], error: null }],
  });
}

describe("getGivingData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getGivingData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyGivingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getGivingData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters all giving queries by organization_id", async () => {
    const { client, queryLog } = createEmptyGivingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getGivingData(TEST_ORGANIZATION_ID);

    expect(queryLog.length).toBeGreaterThan(0);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty results and zero summary values when the database is empty", async () => {
    const { client } = createEmptyGivingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingData(TEST_ORGANIZATION_ID);

    expect(result.transactions).toEqual([]);
    expect(result.funds).toEqual([]);
    expect(result.summary).toEqual({
      givingThisMonth: 0,
      yearToDateGiving: 0,
      transactionCount: 0,
      activeGiverCount: 0,
    });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [
        { data: null, error: createBackendError("giving query failed") },
      ],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getGivingData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
