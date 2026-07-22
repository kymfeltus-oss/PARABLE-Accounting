import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getTransactionsData } from "./transactions-repository";
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

function createEmptyTransactionsMockClient() {
  return createMockSupabaseClient({
    bank_transactions: [{ data: [], error: null }],
    bank_transaction_matches: [{ data: [], error: null }],
  });
}

describe("getTransactionsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getTransactionsData("")).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyTransactionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getTransactionsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters transaction queries by organization_id", async () => {
    const { client, queryLog } = createEmptyTransactionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getTransactionsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(2);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty results and zero counts when the database is empty", async () => {
    const { client } = createEmptyTransactionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getTransactionsData(TEST_ORGANIZATION_ID);

    expect(result.transactions).toEqual([]);
    expect(result.matches).toEqual([]);
    expect(result.counts).toEqual({
      total: 0,
      unmatched: 0,
      matched: 0,
      excluded: 0,
    });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      bank_transactions: [
        {
          data: null,
          error: createBackendError("transactions query failed"),
        },
      ],
      bank_transaction_matches: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getTransactionsData(TEST_ORGANIZATION_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
