import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getAccountingData } from "./accounting-repository";
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

function createEmptyAccountingMockClient() {
  return createMockSupabaseClient({
    accounts: [{ data: [], error: null }],
    accounting_periods: [{ data: [], error: null }],
    journal_entries: [{ data: [], error: null }],
  });
}

describe("getAccountingData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getAccountingData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyAccountingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getAccountingData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyAccountingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getAccountingData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(3);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty accounting data and zero counts when the database is empty", async () => {
    const { client } = createEmptyAccountingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAccountingData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.accounts).toEqual([]);
    expect(result.periods).toEqual([]);
    expect(result.journalEntries).toEqual([]);
    expect(result.counts).toEqual({
      totalAccounts: 0,
      activeAccounts: 0,
      openPeriods: 0,
      closedPeriods: 0,
      postedJournalEntries: 0,
      draftJournalEntries: 0,
    });
  });

  it("counts active accounts using the schema status field", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [
        {
          data: [
            {
              id: "account-1",
              organization_id: TEST_ORGANIZATION_ID,
              parent_account_id: null,
              code: "1000",
              name: "Cash",
              account_type: "asset",
              is_posting: true,
              status: "active",
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
            {
              id: "account-2",
              organization_id: TEST_ORGANIZATION_ID,
              parent_account_id: null,
              code: "5100",
              name: "Office Expense",
              account_type: "expense",
              is_posting: true,
              status: "inactive",
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      accounting_periods: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAccountingData(TEST_ORGANIZATION_ID);

    expect(result.counts.totalAccounts).toBe(2);
    expect(result.counts.activeAccounts).toBe(1);
    expect(result.accounts.map((account) => account.account_type)).toEqual([
      "asset",
      "expense",
    ]);
  });

  it("counts open and closed periods and marks the current period from schema dates and status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      accounting_periods: [
        {
          data: [
            {
              id: "period-open",
              organization_id: TEST_ORGANIZATION_ID,
              name: "July 2026",
              start_date: "2026-07-01",
              end_date: "2026-07-31",
              status: "open",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "period-closed",
              organization_id: TEST_ORGANIZATION_ID,
              name: "June 2026",
              start_date: "2026-06-01",
              end_date: "2026-06-30",
              status: "closed",
              created_at: "2026-06-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "period-locked",
              organization_id: TEST_ORGANIZATION_ID,
              name: "May 2026",
              start_date: "2026-05-01",
              end_date: "2026-05-31",
              status: "locked",
              created_at: "2026-05-01T12:00:00.000Z",
              updated_at: "2026-06-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      journal_entries: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAccountingData(TEST_ORGANIZATION_ID);

    expect(result.counts.openPeriods).toBe(1);
    expect(result.counts.closedPeriods).toBe(1);
    expect(
      result.periods.find((period) => period.id === "period-open")?.isCurrent,
    ).toBe(true);
    expect(
      result.periods.find((period) => period.id === "period-closed")?.isCurrent,
    ).toBe(false);
    expect(
      result.periods.find((period) => period.id === "period-locked")?.isCurrent,
    ).toBe(false);
  });

  it("does not mark an open period as current when today is outside its date range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      accounting_periods: [
        {
          data: [
            {
              id: "period-open-past",
              organization_id: TEST_ORGANIZATION_ID,
              name: "July 2026",
              start_date: "2026-07-01",
              end_date: "2026-07-31",
              status: "open",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      journal_entries: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAccountingData(TEST_ORGANIZATION_ID);

    expect(result.periods[0]?.isCurrent).toBe(false);
  });

  it("aggregates journal line counts and debit/credit totals and balanced state", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      journal_entries: [
        {
          data: [
            {
              id: "journal-balanced",
              organization_id: TEST_ORGANIZATION_ID,
              accounting_period_id: "period-1",
              entry_number: "JE-1001",
              entry_date: "2026-07-10",
              description: "Balanced entry",
              source_type: "manual",
              status: "posted",
              created_at: "2026-07-10T12:00:00.000Z",
              updated_at: "2026-07-10T12:00:00.000Z",
            },
            {
              id: "journal-unbalanced",
              organization_id: TEST_ORGANIZATION_ID,
              accounting_period_id: "period-1",
              entry_number: "JE-1002",
              entry_date: "2026-07-11",
              description: "Unbalanced entry",
              source_type: "manual",
              status: "draft",
              created_at: "2026-07-11T12:00:00.000Z",
              updated_at: "2026-07-11T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      journal_entry_lines: [
        {
          data: [
            {
              journal_entry_id: "journal-balanced",
              debit_amount: 150,
              credit_amount: 0,
            },
            {
              journal_entry_id: "journal-balanced",
              debit_amount: 0,
              credit_amount: 150,
            },
            {
              journal_entry_id: "journal-unbalanced",
              debit_amount: 200,
              credit_amount: 0,
            },
            {
              journal_entry_id: "journal-unbalanced",
              debit_amount: 0,
              credit_amount: 100,
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAccountingData(TEST_ORGANIZATION_ID);
    const balanced = result.journalEntries.find(
      (entry) => entry.id === "journal-balanced",
    );
    const unbalanced = result.journalEntries.find(
      (entry) => entry.id === "journal-unbalanced",
    );

    expect(balanced).toMatchObject({
      lineCount: 2,
      debitTotal: 150,
      creditTotal: 150,
      isBalanced: true,
    });
    expect(unbalanced).toMatchObject({
      lineCount: 2,
      debitTotal: 200,
      creditTotal: 100,
      isBalanced: false,
    });
    expect(result.counts.postedJournalEntries).toBe(1);
    expect(result.counts.draftJournalEntries).toBe(1);
  });

  it("does not expose account balances or trial balance totals", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [
        {
          data: [
            {
              id: "account-1",
              organization_id: TEST_ORGANIZATION_ID,
              parent_account_id: null,
              code: "1000",
              name: "Cash",
              account_type: "asset",
              is_posting: true,
              status: "active",
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      accounting_periods: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAccountingData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("accountBalances");
    expect(result).not.toHaveProperty("trialBalance");
    expect(result.accounts[0]).not.toHaveProperty("balance");
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [{ data: null, error: createBackendError("accounts failed") }],
      accounting_periods: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getAccountingData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
