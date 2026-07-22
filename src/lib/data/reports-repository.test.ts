import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getReportsData } from "./reports-repository";
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

function createEmptyReportsMockClient() {
  return createMockSupabaseClient({
    giving_transactions: [{ data: [], error: null }],
    expenses: [{ data: [], error: null }],
    bills: [{ data: [], error: null }],
    budgets: [{ data: [], error: null }],
    journal_entries: [{ data: [], error: null }],
    accounts: [{ data: [], error: null }],
    accounting_periods: [{ data: [], error: null }],
    members: [{ data: [], error: null }],
    vendors: [{ data: [], error: null }],
    funds: [{ data: [], error: null }],
  });
}

describe("getReportsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getReportsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyReportsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getReportsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyReportsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getReportsData(TEST_ORGANIZATION_ID);

    expect(queryLog.length).toBeGreaterThanOrEqual(10);
    for (const query of queryLog) {
      if (
        query.table === "budget_lines" ||
        query.table === "journal_entry_lines"
      ) {
        continue;
      }

      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns zero summaries when the database is empty", async () => {
    const { client } = createEmptyReportsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.snapshots).toEqual({
      recordedGivingTotal: 0,
      nonVoidExpenseTotal: 0,
      openPayablesAmount: 0,
      totalBudgetedAmount: 0,
    });
    expect(result.summaries.giving.recordedTransactionCount).toBe(0);
  });

  it("includes only recorded giving in monetary totals", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      giving_transactions: [
        {
          data: [
            {
              id: "giving-1",
              status: "recorded",
              fund_id: "fund-1",
              amount: 100,
              transaction_date: "2026-07-10",
            },
            {
              id: "giving-2",
              status: "pending",
              fund_id: null,
              amount: 500,
              transaction_date: "2026-07-11",
            },
            {
              id: "giving-3",
              status: "recorded",
              fund_id: "fund-1",
              amount: 200,
              transaction_date: "2026-01-15",
            },
          ],
          error: null,
        },
      ],
      expenses: [{ data: [], error: null }],
      bills: [{ data: [], error: null }],
      budgets: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      members: [{ data: [], error: null }],
      vendors: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result.snapshots.recordedGivingTotal).toBe(300);
    expect(result.summaries.giving.givingThisMonth).toBe(100);
    expect(result.summaries.giving.yearToDateGiving).toBe(300);
    expect(result.summaries.giving.recordedTransactionCount).toBe(2);
    expect(result.summaries.organization.fundsWithRecordedGiving).toBe(1);
  });

  it("excludes void expenses from totals", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      giving_transactions: [{ data: [], error: null }],
      expenses: [
        {
          data: [
            {
              id: "expense-1",
              expense_date: "2026-07-10",
              total_amount: 100,
              status: "approved",
            },
            {
              id: "expense-2",
              expense_date: "2026-07-12",
              total_amount: 250,
              status: "void",
            },
          ],
          error: null,
        },
      ],
      bills: [{ data: [], error: null }],
      budgets: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      members: [{ data: [], error: null }],
      vendors: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result.snapshots.nonVoidExpenseTotal).toBe(100);
    expect(result.summaries.expenses.nonVoidCount).toBe(1);
    expect(result.summaries.expenses.amountThisMonth).toBe(100);
  });

  it("uses draft and open bills for open payables and excludes void bills", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
      bills: [
        {
          data: [
            {
              id: "bill-1",
              status: "open",
              total_amount: 300,
            },
            {
              id: "bill-2",
              status: "draft",
              total_amount: 150,
            },
            {
              id: "bill-3",
              status: "paid",
              total_amount: 500,
            },
            {
              id: "bill-4",
              status: "void",
              total_amount: 999,
            },
          ],
          error: null,
        },
      ],
      budgets: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      members: [{ data: [], error: null }],
      vendors: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result.snapshots.openPayablesAmount).toBe(450);
    expect(result.summaries.bills.nonVoidCount).toBe(3);
    expect(result.summaries.bills.openCount).toBe(2);
    expect(result.summaries.bills.paidCount).toBe(1);
  });

  it("derives budget totals from budget lines", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
      bills: [{ data: [], error: null }],
      budgets: [
        {
          data: [{ id: "budget-1" }, { id: "budget-2" }],
          error: null,
        },
      ],
      budget_lines: [
        {
          data: [
            { budget_id: "budget-1", amount: 2500 },
            { budget_id: "budget-1", amount: 5000 },
          ],
          error: null,
        },
      ],
      journal_entries: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      members: [{ data: [], error: null }],
      vendors: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result.snapshots.totalBudgetedAmount).toBe(7500);
    expect(result.summaries.budgets.budgetCount).toBe(2);
    expect(result.summaries.budgets.budgetsWithLines).toBe(1);
  });

  it("aggregates posted journal debit and credit totals from journal lines only", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
      bills: [{ data: [], error: null }],
      budgets: [{ data: [], error: null }],
      journal_entries: [
        {
          data: [
            { id: "journal-posted", status: "posted" },
            { id: "journal-draft", status: "draft" },
          ],
          error: null,
        },
      ],
      journal_entry_lines: [
        {
          data: [
            {
              journal_entry_id: "journal-posted",
              debit_amount: 150,
              credit_amount: 0,
            },
            {
              journal_entry_id: "journal-posted",
              debit_amount: 0,
              credit_amount: 150,
            },
            {
              journal_entry_id: "journal-draft",
              debit_amount: 999,
              credit_amount: 0,
            },
          ],
          error: null,
        },
      ],
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      members: [{ data: [], error: null }],
      vendors: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result.summaries.accounting.postedJournalCount).toBe(1);
    expect(result.summaries.accounting.postedDebitTotal).toBe(150);
    expect(result.summaries.accounting.postedCreditTotal).toBe(150);
  });

  it("does not expose formal financial statements or account balances", async () => {
    const { client } = createEmptyReportsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getReportsData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("balanceSheet");
    expect(result).not.toHaveProperty("incomeStatement");
    expect(result).not.toHaveProperty("trialBalance");
    expect(result).not.toHaveProperty("accountBalances");
    expect(result.unavailableReports.length).toBeGreaterThan(0);
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [
        { data: null, error: createBackendError("giving failed") },
      ],
      expenses: [{ data: [], error: null }],
      bills: [{ data: [], error: null }],
      budgets: [{ data: [], error: null }],
      journal_entries: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
      members: [{ data: [], error: null }],
      vendors: [{ data: [], error: null }],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getReportsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
