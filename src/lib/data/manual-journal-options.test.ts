import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getManualJournalOptions } from "./manual-journal-options";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";
import type {
  AccountRow,
  AccountingPeriodRow,
  FundRow,
} from "./types/rows";

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

const OTHER_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

function createAccountRow(
  overrides: Partial<AccountRow> & Pick<AccountRow, "id" | "code" | "name">,
): AccountRow {
  return {
    organization_id: TEST_ORGANIZATION_ID,
    parent_account_id: null,
    account_type: "asset",
    is_posting: true,
    status: "active",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function createFundRow(
  overrides: Partial<FundRow> & Pick<FundRow, "id" | "name">,
): FundRow {
  return {
    organization_id: TEST_ORGANIZATION_ID,
    code: "GEN",
    fund_type: "unrestricted",
    status: "active",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function createPeriodRow(
  overrides: Partial<AccountingPeriodRow> &
    Pick<AccountingPeriodRow, "id" | "name">,
): AccountingPeriodRow {
  return {
    organization_id: TEST_ORGANIZATION_ID,
    start_date: "2026-07-01",
    end_date: "2026-07-31",
    status: "open",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function hasFilter(
  query: { filters: { method: string; args: unknown[] }[] },
  method: string,
  args: unknown[],
) {
  return query.filters.some(
    (filter) =>
      filter.method === method &&
      JSON.stringify(filter.args) === JSON.stringify(args),
  );
}

describe("getManualJournalOptions", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getManualJournalOptions("")).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getManualJournalOptions(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("scopes accounts, funds, and periods by organization_id", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getManualJournalOptions(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(3);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("filters active posting accounts only", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getManualJournalOptions(TEST_ORGANIZATION_ID);

    const accountsQuery = queryLog.find((query) => query.table === "accounts");
    expect(accountsQuery).toBeDefined();
    expect(hasFilter(accountsQuery!, "eq", ["status", "active"])).toBe(true);
    expect(hasFilter(accountsQuery!, "eq", ["is_posting", true])).toBe(true);
  });

  it("filters active funds only", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getManualJournalOptions(TEST_ORGANIZATION_ID);

    const fundsQuery = queryLog.find((query) => query.table === "funds");
    expect(fundsQuery).toBeDefined();
    expect(hasFilter(fundsQuery!, "eq", ["status", "active"])).toBe(true);
  });

  it("filters open accounting periods only", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getManualJournalOptions(TEST_ORGANIZATION_ID);

    const periodsQuery = queryLog.find(
      (query) => query.table === "accounting_periods",
    );
    expect(periodsQuery).toBeDefined();
    expect(hasFilter(periodsQuery!, "eq", ["status", "open"])).toBe(true);
  });

  it("returns deterministically sorted options and excludes cross-org rows", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [
        {
          data: [
            createAccountRow({
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              code: "2000",
              name: "Payables",
              account_type: "liability",
            }),
            createAccountRow({
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              code: "1000",
              name: "Cash",
            }),
            createAccountRow({
              id: "99999999-9999-4999-8999-999999999999",
              code: "1000",
              name: "Other Org Cash",
              organization_id: OTHER_ORGANIZATION_ID,
            }),
          ],
          error: null,
        },
      ],
      funds: [
        {
          data: [
            createFundRow({
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              code: "RST",
              name: "Restricted",
            }),
            createFundRow({
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              code: "GEN",
              name: "General",
            }),
          ],
          error: null,
        },
      ],
      accounting_periods: [
        {
          data: [
            createPeriodRow({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              name: "August 2026",
              start_date: "2026-08-01",
              end_date: "2026-08-31",
            }),
            createPeriodRow({
              id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              name: "July 2026",
              start_date: "2026-07-01",
              end_date: "2026-07-31",
            }),
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getManualJournalOptions(TEST_ORGANIZATION_ID);

    expect(result.accounts).toEqual([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        code: "1000",
        name: "Cash",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        code: "2000",
        name: "Payables",
      },
    ]);
    expect(result.funds).toEqual([
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        code: "GEN",
        name: "General",
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        code: "RST",
        name: "Restricted",
      },
    ]);
    expect(result.periods).toEqual([
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        name: "July 2026",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        isOpen: true,
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "August 2026",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        isOpen: true,
      },
    ]);
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [{ data: null, error: createBackendError("accounts failed") }],
      funds: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getManualJournalOptions(TEST_ORGANIZATION_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
