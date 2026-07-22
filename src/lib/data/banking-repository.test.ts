import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getBankingData } from "./banking-repository";
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

function createEmptyBankingMockClient() {
  return createMockSupabaseClient({
    bank_accounts: [{ data: [], error: null }],
    bank_transactions: [
      { data: [], error: null },
      { count: 0, error: null },
    ],
  });
}

describe("getBankingData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getBankingData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyBankingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBankingData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters banking queries by organization_id", async () => {
    const { client, queryLog } = createEmptyBankingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBankingData(TEST_ORGANIZATION_ID);

    expect(queryLog.length).toBe(3);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty results and zero counts when the database is empty", async () => {
    const { client } = createEmptyBankingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBankingData(TEST_ORGANIZATION_ID);

    expect(result.accounts).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.counts).toEqual({
      accountCount: 0,
      transactionCount: 0,
      unmatchedTransactionCount: 0,
    });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      bank_accounts: [
        { data: null, error: createBackendError("bank accounts query failed") },
      ],
      bank_transactions: [
        { data: [], error: null },
        { count: 0, error: null },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getBankingData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
