import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFinancialReportsFromContext,
  loadLedgerBalanceContext,
} from "./ledger-balances-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const { createServerSupabaseClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

describe("loadLedgerBalanceContext", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("pages journal entry lines with a stable order and range", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      journal_entries: [
        {
          data: [
            {
              id: "journal-posted",
              status: "posted",
              entry_date: "2026-07-01",
            },
          ],
          error: null,
        },
      ],
      accounts: [
        {
          data: [
            {
              id: "account-cash",
              code: "1000",
              name: "Cash",
              account_type: "asset",
            },
          ],
          error: null,
        },
      ],
      funds: [{ data: [], error: null }],
      journal_entry_lines: [
        {
          data: [
            {
              journal_entry_id: "journal-posted",
              account_id: "account-cash",
              fund_id: null,
              debit_amount: 100,
              credit_amount: 0,
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await loadLedgerBalanceContext(TEST_ORGANIZATION_ID);

    const lineQuery = queryLog.find(
      (query) => query.table === "journal_entry_lines",
    );
    expect(lineQuery?.filters.some((filter) => filter.method === "order")).toBe(
      true,
    );
    expect(lineQuery?.filters.some((filter) => filter.method === "range")).toBe(
      true,
    );
  });

  it("loads only posted journal entry lines for the organization", async () => {
    const { client } = createMockSupabaseClient({
      journal_entries: [
        {
          data: [
            {
              id: "journal-posted",
              status: "posted",
              entry_date: "2026-07-01",
            },
          ],
          error: null,
        },
      ],
      accounts: [
        {
          data: [
            {
              id: "account-cash",
              code: "1000",
              name: "Cash",
              account_type: "asset",
            },
          ],
          error: null,
        },
      ],
      funds: [{ data: [], error: null }],
      journal_entry_lines: [
        {
          data: [
            {
              journal_entry_id: "journal-posted",
              account_id: "account-cash",
              fund_id: null,
              debit_amount: 100,
              credit_amount: 0,
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const context = await loadLedgerBalanceContext(TEST_ORGANIZATION_ID);

    expect(context.lines).toHaveLength(1);
    expect(context.lines[0]?.debitAmount).toBe(100);
    expect(context.lines[0]?.journalEntryId).toBe("journal-posted");
    expect(
      context.lines.every((line) => line.journalEntryId === "journal-posted"),
    ).toBe(true);
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      journal_entries: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await loadLedgerBalanceContext(TEST_ORGANIZATION_ID);

    for (const query of queryLog) {
      if (query.table === "journal_entry_lines") {
        continue;
      }

      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("builds financial reports from loaded context", async () => {
    const context = {
      organizationId: TEST_ORGANIZATION_ID,
      asOfDate: "2026-07-31",
      periodStartDate: "2026-07-01",
      periodEndDate: "2026-07-31",
      lines: [
        {
          journalEntryId: "journal-posted",
          entryDate: "2026-07-10",
          accountId: "account-cash",
          accountType: "asset" as const,
          accountCode: "1000",
          accountName: "Cash",
          fundId: "fund-1",
          debitAmount: 100,
          creditAmount: 0,
        },
        {
          journalEntryId: "journal-posted",
          entryDate: "2026-07-10",
          accountId: "account-revenue",
          accountType: "revenue" as const,
          accountCode: "4000",
          accountName: "Donations",
          fundId: "fund-1",
          debitAmount: 0,
          creditAmount: 100,
        },
      ],
      accounts: [
        {
          id: "account-cash",
          code: "1000",
          name: "Cash",
          accountType: "asset" as const,
        },
        {
          id: "account-revenue",
          code: "4000",
          name: "Donations",
          accountType: "revenue" as const,
        },
      ],
      funds: [{ id: "fund-1", name: "General Fund", code: "GEN" }],
    };

    const reports = buildFinancialReportsFromContext(context);

    expect(reports.trialBalance.isBalanced).toBe(true);
    expect(reports.incomeStatement.netIncome).toBe(100);
    expect(reports.balanceSheet.unclosedChangeInNetAssets).toBe(100);
    expect(reports.balanceSheet.isEquationBalanced).toBe(true);
    expect(reports.fundBalance.rows).toEqual([
      expect.objectContaining({ id: "fund-1", balance: 100 }),
    ]);
    expect(reports.fundBalance.totalBalance).toBe(100);
  });

  it("throws when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      journal_entries: [
        { data: null, error: createBackendError("journal entries failed") },
      ],
      accounts: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(loadLedgerBalanceContext(TEST_ORGANIZATION_ID)).rejects.toThrow(
      "journal entries failed",
    );
  });
});
