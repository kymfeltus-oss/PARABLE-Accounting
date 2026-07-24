import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createFund, getFundsData, updateFund } from "./funds-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const {
  createAdminSupabaseClientMock,
  createServerSupabaseClientMock,
  loadLedgerBalanceContextMock,
} = vi.hoisted(() => ({
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
    asOfDate: "2026-07-24",
    periodStartDate: "2026-01-01",
    periodEndDate: "2026-07-24",
    lines: [],
    accounts: [],
    funds: [],
  });
}

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
    loadLedgerBalanceContextMock.mockReset();
    mockLedgerContext();
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
    expect(result.asOfDate).toBe("2026-07-24");
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

  it("derives ledgerBalance from posted journal lines by fund", async () => {
    loadLedgerBalanceContextMock.mockResolvedValue({
      organizationId: TEST_ORGANIZATION_ID,
      asOfDate: "2026-07-24",
      periodStartDate: "2026-01-01",
      periodEndDate: "2026-07-24",
      lines: [
        {
          journalEntryId: "journal-posted",
          entryDate: "2026-07-01",
          accountId: "account-cash",
          accountType: "asset",
          accountCode: "1000",
          accountName: "Cash",
          fundId: "fund-1",
          debitAmount: 500,
          creditAmount: 0,
        },
        {
          journalEntryId: "journal-posted",
          entryDate: "2026-07-01",
          accountId: "account-revenue",
          accountType: "revenue",
          accountCode: "4000",
          accountName: "Donations",
          fundId: "fund-1",
          debitAmount: 0,
          creditAmount: 500,
        },
      ],
      accounts: [],
      funds: [{ id: "fund-1", name: "General Fund", code: "GEN" }],
    });

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
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      giving_transactions: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
      bills: [{ data: [], error: null }],
      budgets: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getFundsData(TEST_ORGANIZATION_ID);

    expect(result.funds[0]?.ledgerBalance).toBe(0);
    expect(result.asOfDate).toBe("2026-07-24");
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

function createCreatedFundRow(overrides: Partial<{
  id: string;
  code: string | null;
  fund_type: string;
  status: string;
}> = {}) {
  return {
    id: "55555555-5555-5555-8555-555555555555",
    organization_id: TEST_ORGANIZATION_ID,
    name: "General Fund",
    code: "GEN",
    fund_type: "unrestricted",
    status: "active",
    created_at: "2026-07-24T12:00:00.000Z",
    updated_at: "2026-07-24T12:00:00.000Z",
    ...overrides,
  };
}

function createFundRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyFundsMockClient();
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

describe("createFund", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(createFund("", { name: "General Fund" })).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("rejects blank fund names", async () => {
    await expect(
      createFund(TEST_ORGANIZATION_ID, { name: "   " }),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the create_fund RPC with exact argument names", async () => {
    const { client, rpcMock } = createFundRpcMockClient({
      data: createCreatedFundRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createFund(TEST_ORGANIZATION_ID, {
      name: "General Fund",
      code: "GEN",
      fundType: "unrestricted",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_fund", {
      target_organization_id: TEST_ORGANIZATION_ID,
      fund_name: "General Fund",
      fund_code: "GEN",
      fund_type: "unrestricted",
    });
  });

  it("maps omitted optional values to null in the RPC payload", async () => {
    const { client, rpcMock } = createFundRpcMockClient({
      data: createCreatedFundRow({ code: null }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createFund(TEST_ORGANIZATION_ID, { name: "General Fund" });

    expect(rpcMock).toHaveBeenCalledWith("create_fund", {
      target_organization_id: TEST_ORGANIZATION_ID,
      fund_name: "General Fund",
      fund_code: null,
      fund_type: null,
    });
  });

  it("does not perform a direct funds table insert, update, or delete", async () => {
    const { client, fromMock } = createFundRpcMockClient({
      data: createCreatedFundRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createFund(TEST_ORGANIZATION_ID, { name: "General Fund" });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createFundRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to create fund"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createFund(TEST_ORGANIZATION_ID, { name: "General Fund" }),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("updateFund", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("calls the update_fund RPC with exact argument names", async () => {
    const { client, rpcMock } = createFundRpcMockClient({
      data: createCreatedFundRow({ status: "inactive" }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateFund(TEST_ORGANIZATION_ID, {
      fundId: "55555555-5555-5555-8555-555555555555",
      name: "General Fund",
      code: "GEN",
      fundType: "unrestricted",
      status: "inactive",
    });

    expect(rpcMock).toHaveBeenCalledWith("update_fund", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_fund_id: "55555555-5555-5555-8555-555555555555",
      fund_name: "General Fund",
      fund_code: "GEN",
      fund_type: "unrestricted",
      fund_status: "inactive",
    });
  });
});
