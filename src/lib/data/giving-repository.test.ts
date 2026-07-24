import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getGivingData, getGivingTransactionById, recordGiving } from "./giving-repository";
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

function createEmptyGivingMockClient() {
  return createMockSupabaseClient({
    giving_transactions: [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ],
    funds: [{ data: [], error: null }],
  });
}

describe("getGivingData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getGivingData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyGivingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getGivingData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters all giving queries by organization_id", async () => {
    const { client, queryLog } = createEmptyGivingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getGivingData(TEST_ORGANIZATION_ID);

    expect(queryLog.length).toBeGreaterThan(0);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty results and zero summary values when the database is empty", async () => {
    const { client } = createEmptyGivingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingData(TEST_ORGANIZATION_ID);

    expect(result.transactions).toEqual([]);
    expect(result.funds).toEqual([]);
    expect(result.summary).toEqual({
      givingThisMonth: 0,
      yearToDateGiving: 0,
      transactionCount: 0,
      activeGiverCount: 0,
    });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [
        { data: null, error: createBackendError("giving query failed") },
      ],
      funds: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getGivingData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

const TEST_GIVING_TRANSACTION_ID = "55555555-5555-4555-8555-555555555555";
const TEST_DEBIT_ACCOUNT_ID = "77777777-7777-4777-8777-777777777771";
const TEST_CREDIT_ACCOUNT_ID = "99999999-9999-4999-8999-999999999999";
const TEST_JOURNAL_ENTRY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createRecordedGivingRow() {
  return {
    id: TEST_GIVING_TRANSACTION_ID,
    organization_id: TEST_ORGANIZATION_ID,
    member_id: null,
    fund_id: null,
    transaction_date: "2026-07-20",
    amount: 250,
    giving_method: "cash",
    reference: "GIV-2001",
    status: "recorded",
    journal_entry_id: TEST_JOURNAL_ENTRY_ID,
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
  };
}

function createRecordGivingRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyGivingMockClient();
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

describe("recordGiving", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      recordGiving(
        "",
        TEST_GIVING_TRANSACTION_ID,
        TEST_DEBIT_ACCOUNT_ID,
        TEST_CREDIT_ACCOUNT_ID,
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createRecordGivingRpcMockClient({
      data: createRecordedGivingRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await recordGiving(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_TRANSACTION_ID,
      TEST_DEBIT_ACCOUNT_ID,
      TEST_CREDIT_ACCOUNT_ID,
    );

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the record_giving RPC with exact argument names", async () => {
    const { client, rpcMock } = createRecordGivingRpcMockClient({
      data: createRecordedGivingRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await recordGiving(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_TRANSACTION_ID,
      TEST_DEBIT_ACCOUNT_ID,
      TEST_CREDIT_ACCOUNT_ID,
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("record_giving", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_giving_transaction_id: TEST_GIVING_TRANSACTION_ID,
      input_debit_account_id: TEST_DEBIT_ACCOUNT_ID,
      input_credit_account_id: TEST_CREDIT_ACCOUNT_ID,
    });
  });

  it("returns the recorded giving row from the RPC", async () => {
    const recordedRow = createRecordedGivingRow();
    const { client } = createRecordGivingRpcMockClient({
      data: recordedRow,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await recordGiving(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_TRANSACTION_ID,
      TEST_DEBIT_ACCOUNT_ID,
      TEST_CREDIT_ACCOUNT_ID,
    );

    expect(result).toEqual(recordedRow);
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createRecordGivingRpcMockClient({
      data: null,
      error: createBackendError(
        "Giving transaction is not in recorded status",
      ),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      recordGiving(
        TEST_ORGANIZATION_ID,
        TEST_GIVING_TRANSACTION_ID,
        TEST_DEBIT_ACCOUNT_ID,
        TEST_CREDIT_ACCOUNT_ID,
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("does not perform a direct table query or id-only lookup", async () => {
    const { client, fromMock } = createRecordGivingRpcMockClient({
      data: createRecordedGivingRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await recordGiving(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_TRANSACTION_ID,
      TEST_DEBIT_ACCOUNT_ID,
      TEST_CREDIT_ACCOUNT_ID,
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws DataAccessError when the RPC returns no row", async () => {
    const { client } = createRecordGivingRpcMockClient({
      data: null,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      recordGiving(
        TEST_ORGANIZATION_ID,
        TEST_GIVING_TRANSACTION_ID,
        TEST_DEBIT_ACCOUNT_ID,
        TEST_CREDIT_ACCOUNT_ID,
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

const TEST_GIVING_DETAIL_ID = "55555555-5555-4555-8555-555555555555";
const TEST_FUND_ID = "966522d9-8fe4-497b-b5a6-8cb449f2372e";

function createGivingTransactionRow(
  overrides: Partial<{
    id: string;
    organization_id: string;
    fund_id: string | null;
    status: string;
    journal_entry_id: string | null;
    reference: string | null;
  }> = {},
) {
  return {
    id: TEST_GIVING_DETAIL_ID,
    organization_id: TEST_ORGANIZATION_ID,
    member_id: "member-1",
    fund_id: TEST_FUND_ID,
    transaction_date: "2026-07-10",
    amount: 250,
    giving_method: "check",
    reference: "CHK-1001",
    status: "recorded",
    journal_entry_id: null,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("getGivingTransactionById", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getGivingTransactionById("", TEST_GIVING_DETAIL_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("returns null when no organization-scoped transaction exists", async () => {
    const { client } = createMockSupabaseClient({
      giving_transactions: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getGivingTransactionById(TEST_ORGANIZATION_ID, TEST_GIVING_DETAIL_ID),
    ).resolves.toBeNull();
  });

  it("returns the transaction with fund name when fund lookup succeeds", async () => {
    const transaction = createGivingTransactionRow();
    const { client, queryLog } = createMockSupabaseClient({
      giving_transactions: [{ data: [transaction], error: null }],
      funds: [{ data: [{ name: "General Fund" }], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingTransactionById(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_DETAIL_ID,
    );

    expect(result).toEqual({
      ...transaction,
      fundName: "General Fund",
    });
    expect(
      queryLog.some(
        (query) =>
          query.table === "giving_transactions" &&
          hasOrganizationFilter(query, TEST_ORGANIZATION_ID),
      ),
    ).toBe(true);
  });

  it("returns the transaction without querying funds when fund_id is null", async () => {
    const transaction = createGivingTransactionRow({ fund_id: null });
    const { client, queryLog } = createMockSupabaseClient({
      giving_transactions: [{ data: [transaction], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingTransactionById(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_DETAIL_ID,
    );

    expect(result).toEqual({
      ...transaction,
      fundName: null,
    });
    expect(queryLog.some((query) => query.table === "funds")).toBe(false);
  });
});
