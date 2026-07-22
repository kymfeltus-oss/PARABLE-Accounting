import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getFundsData } from "./funds-repository";
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

function createEmptyFundsMockClient() {
  return createMockSupabaseClient({
    funds: [{ data: [], error: null }],
    giving_transactions: [{ data: [], error: null }],
    expenses: [{ data: [], error: null }],
    bills: [{ data: [], error: null }],
    budgets: [{ data: [], error: null }],
  });
}

describe("getFundsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getFundsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyFundsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getFundsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyFundsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getFundsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(5);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty funds and zero counts when the database is empty", async () => {
    const { client } = createEmptyFundsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getFundsData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.funds).toEqual([]);
    expect(result.counts).toEqual({
      total: 0,
      withGiving: 0,
      withExpenses: 0,
      withBudgetAllocations: 0,
    });
  });

  it("aggregates giving, expense lines, bill lines, and budget lines by fund", async () => {
    const { client } = createMockSupabaseClient({
      funds: [
        {
          data: [
            {
              id: "fund-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "General Fund",
              code: "GEN",
              fund_type: "unrestricted",
              status: "active",
              created_at: "2026-06-01T12:00:00.000Z",
              updated_at: "2026-06-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      giving_transactions: [
        {
          data: [
            {
              fund_id: "fund-1",
              amount: 100,
              status: "recorded",
            },
          ],
          error: null,
        },
      ],
      expenses: [
        {
          data: [
            { id: "expense-active", status: "recorded" },
            { id: "expense-void", status: "void" },
          ],
          error: null,
        },
      ],
      bills: [
        {
          data: [
            { id: "bill-active", status: "open" },
            { id: "bill-void", status: "void" },
          ],
          error: null,
        },
      ],
      budgets: [{ data: [{ id: "budget-1" }], error: null }],
      expense_lines: [
        {
          data: [
            {
              expense_id: "expense-active",
              fund_id: "fund-1",
              amount: 25,
            },
            {
              expense_id: "expense-void",
              fund_id: "fund-1",
              amount: 999,
            },
          ],
          error: null,
        },
      ],
      bill_lines: [
        {
          data: [
            {
              bill_id: "bill-active",
              fund_id: "fund-1",
              amount: 40,
            },
            {
              bill_id: "bill-void",
              fund_id: "fund-1",
              amount: 888,
            },
          ],
          error: null,
        },
      ],
      budget_lines: [
        {
          data: [{ fund_id: "fund-1", amount: 500 }],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getFundsData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      total: 1,
      withGiving: 1,
      withExpenses: 1,
      withBudgetAllocations: 1,
    });
    expect(result.funds[0]).toMatchObject({
      givingTransactionCount: 1,
      givingTotalAmount: 100,
      expenseLineCount: 1,
      expenseAllocationTotal: 25,
      billLineCount: 1,
      billAllocationTotal: 40,
      budgetLineCount: 1,
      budgetAllocationTotal: 500,
    });
  });

  it("does not fabricate a current fund balance field", async () => {
    const { client } = createEmptyFundsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getFundsData(TEST_ORGANIZATION_ID);

    for (const fund of result.funds) {
      expect(fund).not.toHaveProperty("currentBalance");
      expect(fund).not.toHaveProperty("availableBalance");
    }
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      funds: [
        {
          data: null,
          error: createBackendError("funds query failed"),
        },
      ],
      giving_transactions: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
      bills: [{ data: [], error: null }],
      budgets: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getFundsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
