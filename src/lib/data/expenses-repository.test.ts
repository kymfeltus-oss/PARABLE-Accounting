import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getExpensesData } from "./expenses-repository";
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

function createEmptyExpensesMockClient() {
  return createMockSupabaseClient({
    expenses: [{ data: [], error: null }],
    vendors: [{ data: [], error: null }],
  });
}

describe("getExpensesData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getExpensesData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyExpensesMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpensesData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters expenses and vendors by organization_id", async () => {
    const { client, queryLog } = createEmptyExpensesMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpensesData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(2);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty expenses and zero totals when the database is empty", async () => {
    const { client } = createEmptyExpensesMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpensesData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.expenses).toEqual([]);
    expect(result.counts).toEqual({ total: 0, thisMonth: 0 });
    expect(result.summary).toEqual({ totalAmount: 0, amountThisMonth: 0 });
  });

  it("excludes void expenses from totals and monthly metrics", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      expenses: [
        {
          data: [
            {
              id: "expense-recorded",
              organization_id: TEST_ORGANIZATION_ID,
              vendor_id: "vendor-1",
              expense_date: "2026-07-10",
              description: "Recorded expense",
              total_amount: 100,
              reference: null,
              payment_source: "bank",
              status: "recorded",
              created_at: "2026-07-10T12:00:00.000Z",
              updated_at: "2026-07-10T12:00:00.000Z",
            },
            {
              id: "expense-draft",
              organization_id: TEST_ORGANIZATION_ID,
              vendor_id: null,
              expense_date: "2026-07-05",
              description: "Draft expense",
              total_amount: 25,
              reference: null,
              payment_source: "cash",
              status: "draft",
              created_at: "2026-07-05T12:00:00.000Z",
              updated_at: "2026-07-05T12:00:00.000Z",
            },
            {
              id: "expense-void",
              organization_id: TEST_ORGANIZATION_ID,
              vendor_id: null,
              expense_date: "2026-07-01",
              description: "Void expense",
              total_amount: 999,
              reference: null,
              payment_source: "other",
              status: "void",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "expense-prior-month",
              organization_id: TEST_ORGANIZATION_ID,
              vendor_id: null,
              expense_date: "2026-06-15",
              description: "Prior month expense",
              total_amount: 40,
              reference: null,
              payment_source: "card",
              status: "recorded",
              created_at: "2026-06-15T12:00:00.000Z",
              updated_at: "2026-06-15T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      vendors: [{ data: [], error: null }],
      expense_lines: [
        {
          data: [{ expense_id: "expense-recorded" }, { expense_id: "expense-recorded" }],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpensesData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({ total: 3, thisMonth: 2 });
    expect(result.summary).toEqual({ totalAmount: 165, amountThisMonth: 125 });
    expect(result.expenses.find((expense) => expense.id === "expense-recorded")?.lineCount).toBe(
      2,
    );
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      expenses: [
        {
          data: null,
          error: createBackendError("expenses query failed"),
        },
      ],
      vendors: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getExpensesData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
