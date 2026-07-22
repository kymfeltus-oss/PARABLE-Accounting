import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getBudgetsData } from "./budgets-repository";
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

function createEmptyBudgetsMockClient() {
  return createMockSupabaseClient({
    budgets: [{ data: [], error: null }],
    funds: [{ data: [], error: null }],
    accounts: [{ data: [], error: null }],
  });
}

describe("getBudgetsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getBudgetsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyBudgetsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBudgetsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyBudgetsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBudgetsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(3);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty budgets and zero totals when the database is empty", async () => {
    const { client } = createEmptyBudgetsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBudgetsData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.budgets).toEqual([]);
    expect(result.counts).toEqual({
      total: 0,
      withLines: 0,
      current: 0,
    });
    expect(result.summary.totalBudgetedAmount).toBe(0);
  });

  it("aggregates budget lines by fund and account without double counting headers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      budgets: [
        {
          data: [
            {
              id: "budget-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Operating Budget",
              start_date: "2026-01-01",
              end_date: "2026-12-31",
              status: "active",
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      funds: [
        {
          data: [{ id: "fund-1", name: "General Fund" }],
          error: null,
        },
      ],
      accounts: [
        {
          data: [
            { id: "account-1", name: "Office Expense" },
            { id: "account-2", name: "Utilities" },
          ],
          error: null,
        },
      ],
      budget_lines: [
        {
          data: [
            {
              budget_id: "budget-1",
              account_id: "account-1",
              fund_id: "fund-1",
              amount: 100,
            },
            {
              budget_id: "budget-1",
              account_id: "account-2",
              fund_id: "fund-1",
              amount: 250,
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBudgetsData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      total: 1,
      withLines: 1,
      current: 1,
    });
    expect(result.summary.totalBudgetedAmount).toBe(350);
    expect(result.budgets[0]).toMatchObject({
      lineCount: 2,
      totalBudgetedAmount: 350,
    });
    expect(result.budgets[0]?.fundAllocations).toEqual([
      {
        fundId: "fund-1",
        fundName: "General Fund",
        lineCount: 2,
        budgetedAmount: 350,
      },
    ]);
    expect(result.budgets[0]?.accountAllocations).toEqual([
      {
        accountId: "account-1",
        accountName: "Office Expense",
        lineCount: 1,
        budgetedAmount: 100,
      },
      {
        accountId: "account-2",
        accountName: "Utilities",
        lineCount: 1,
        budgetedAmount: 250,
      },
    ]);
  });

  it("does not fabricate actual spend, remaining budget, or variance fields", async () => {
    const { client } = createEmptyBudgetsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBudgetsData(TEST_ORGANIZATION_ID);

    expect(result.summary).not.toHaveProperty("actualSpend");
    expect(result.summary).not.toHaveProperty("remainingBudget");
    expect(result.summary).not.toHaveProperty("variance");
    for (const budget of result.budgets) {
      expect(budget).not.toHaveProperty("actualSpend");
      expect(budget).not.toHaveProperty("remainingBudget");
      expect(budget).not.toHaveProperty("variance");
      expect(budget).not.toHaveProperty("percentUsed");
    }
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      budgets: [
        {
          data: null,
          error: createBackendError("budgets query failed"),
        },
      ],
      funds: [{ data: [], error: null }],
      accounts: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getBudgetsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
