import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  activateBudget,
  createBudget,
  getBudgetsData,
  upsertBudgetLine,
} from "./budgets-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const { createAdminSupabaseClientMock, createServerSupabaseClientMock, loadLedgerBalanceContextMock } =
  vi.hoisted(() => ({
    createAdminSupabaseClientMock: vi.fn(),
    createServerSupabaseClientMock: vi.fn(),
    loadLedgerBalanceContextMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

vi.mock("./ledger-balances-repository", () => ({
  loadLedgerBalanceContext: loadLedgerBalanceContextMock,
}));

function mockLedgerContext() {
  loadLedgerBalanceContextMock.mockResolvedValue({
    organizationId: TEST_ORGANIZATION_ID,
    asOfDate: "2026-07-17",
    periodStartDate: "2026-01-01",
    periodEndDate: "2026-12-31",
    lines: [],
    accounts: [],
    funds: [],
  });
}

function createEmptyBudgetsMockClient() {
  return createMockSupabaseClient({
    budgets: [{ data: [], error: null }],
    funds: [{ data: [], error: null }],
    accounts: [{ data: [], error: null }],
  });
}

function createCreatedBudgetRow(
  overrides: Partial<{
    id: string;
    status: string;
  }> = {},
) {
  return {
    id: "budget-1",
    organization_id: TEST_ORGANIZATION_ID,
    name: "Operating Budget",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    status: "draft",
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

function createBudgetLineRow() {
  return {
    id: "line-1",
    budget_id: "budget-1",
    account_id: "account-1",
    fund_id: "fund-1",
    line_number: 1,
    description: null,
    amount: 100,
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
  };
}

function createBudgetRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyBudgetsMockClient();
  const rpcMock = vi.fn().mockResolvedValue(rpcResponse);
  const fromMock = vi.spyOn(tableClient, "from");

  return {
    client: {
      ...tableClient,
      rpc: rpcMock,
    },
    rpcMock,
    fromMock,
  };
}

describe("getBudgetsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    loadLedgerBalanceContextMock.mockReset();
    mockLedgerContext();
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
    expect(result.accounts).toEqual([]);
    expect(result.funds).toEqual([]);
    expect(result.budgetVsActual).toBeNull();
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
            {
              id: "account-1",
              code: "5100",
              name: "Office Expense",
              account_type: "expense",
            },
            {
              id: "account-2",
              code: "5200",
              name: "Utilities",
              account_type: "expense",
            },
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
    loadLedgerBalanceContextMock.mockResolvedValue({
      organizationId: TEST_ORGANIZATION_ID,
      asOfDate: "2026-07-17",
      periodStartDate: "2026-01-01",
      periodEndDate: "2026-12-31",
      lines: [
        {
          journalEntryId: "je-1",
          entryDate: "2026-03-01",
          accountId: "account-1",
          accountType: "expense",
          accountCode: "5100",
          accountName: "Office Expense",
          fundId: "fund-1",
          debitAmount: 40,
          creditAmount: 0,
        },
      ],
      accounts: [],
      funds: [],
    });

    const result = await getBudgetsData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      total: 1,
      withLines: 1,
      current: 1,
    });
    expect(result.summary.totalBudgetedAmount).toBe(350);
    expect(result.budgetVsActual).toMatchObject({
      budgetId: "budget-1",
      totalBudgeted: 350,
      totalActual: 40,
      totalVariance: 310,
    });
    expect(result.budgets[0]?.budgetVsActual?.rows[0]).toMatchObject({
      accountId: "account-1",
      budgetedAmount: 100,
      actualAmount: 40,
      variance: 60,
    });
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

describe("createBudget", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("calls the create_budget RPC with exact argument names", async () => {
    const { client, rpcMock } = createBudgetRpcMockClient({
      data: createCreatedBudgetRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createBudget(TEST_ORGANIZATION_ID, {
      name: "Operating Budget",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "draft",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_budget", {
      target_organization_id: TEST_ORGANIZATION_ID,
      budget_name: "Operating Budget",
      budget_start_date: "2026-01-01",
      budget_end_date: "2026-12-31",
      budget_status: "draft",
    });
  });
});

describe("upsertBudgetLine", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("calls the upsert_budget_line RPC with exact argument names", async () => {
    const { client, rpcMock } = createBudgetRpcMockClient({
      data: createBudgetLineRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await upsertBudgetLine(TEST_ORGANIZATION_ID, {
      budgetId: "budget-1",
      accountId: "account-1",
      amount: 100,
      fundId: "fund-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("upsert_budget_line", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_budget_id: "budget-1",
      target_account_id: "account-1",
      line_amount: 100,
      target_fund_id: "fund-1",
    });
  });
});

describe("activateBudget", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("calls the activate_budget RPC with exact argument names", async () => {
    const { client, rpcMock } = createBudgetRpcMockClient({
      data: createCreatedBudgetRow({ status: "active" }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await activateBudget(TEST_ORGANIZATION_ID, "budget-1");

    expect(rpcMock).toHaveBeenCalledWith("activate_budget", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_budget_id: "budget-1",
    });
  });
});
