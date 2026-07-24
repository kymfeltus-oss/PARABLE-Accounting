import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  createBankAccount,
  createBankTransaction,
  getBankingData,
  matchBankTransaction,
} from "./banking-repository";
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
    accounts: [
      {
        id: "account-1",
        code: "1000",
        name: "Operating Checking",
        accountType: "asset",
      },
    ],
    funds: [],
  });
}

function createEmptyBankingMockClient() {
  return createMockSupabaseClient({
    bank_accounts: [{ data: [], error: null }],
    bank_transactions: [
      { data: [], error: null },
      { count: 0, error: null },
    ],
    accounts: [{ data: [], error: null }],
  });
}

describe("getBankingData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    loadLedgerBalanceContextMock.mockReset();
    mockLedgerContext();
  });

  it("requires organizationId", async () => {
    await expect(getBankingData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyBankingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBankingData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters banking queries by organization_id", async () => {
    const { client, queryLog } = createEmptyBankingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBankingData(TEST_ORGANIZATION_ID);

    expect(queryLog.length).toBe(4);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty results and zero counts when the database is empty", async () => {
    const { client } = createEmptyBankingMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBankingData(TEST_ORGANIZATION_ID);

    expect(result.accounts).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.assetAccounts).toEqual([]);
    expect(result.counts).toEqual({
      accountCount: 0,
      transactionCount: 0,
      unmatchedTransactionCount: 0,
      matchedTransactionCount: 0,
      totalLedgerCashBalance: 0,
    });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      bank_accounts: [
        { data: null, error: createBackendError("bank accounts query failed") },
      ],
      bank_transactions: [
        { data: [], error: null },
        { count: 0, error: null },
      ],
      accounts: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getBankingData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

function createBankingRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyBankingMockClient();
  const rpcMock = vi.fn().mockResolvedValue(rpcResponse);

  return {
    client: {
      ...tableClient,
      rpc: rpcMock,
    },
    rpcMock,
  };
}

describe("createBankAccount", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("calls create_bank_account RPC", async () => {
    const bankAccount = {
      id: "bank-account-1",
      organization_id: TEST_ORGANIZATION_ID,
      account_id: "account-1",
      name: "Savings",
      institution_name: null,
      account_type: "savings",
      last_four: null,
      status: "active",
      created_at: "2026-07-24T12:00:00.000Z",
      updated_at: "2026-07-24T12:00:00.000Z",
    };
    const { client, rpcMock } = createBankingRpcMockClient({
      data: bankAccount,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await createBankAccount(TEST_ORGANIZATION_ID, {
      name: "Savings",
      accountId: "account-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_bank_account", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_name: "Savings",
      input_account_id: "account-1",
      input_institution_name: null,
      input_account_type: null,
      input_last_four: null,
    });
    expect(result).toEqual(bankAccount);
  });
});

describe("createBankTransaction", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("calls create_bank_transaction RPC", async () => {
    const transaction = {
      id: "bank-tx-1",
      organization_id: TEST_ORGANIZATION_ID,
      bank_account_id: "bank-account-1",
      transaction_date: "2026-07-24",
      posted_date: null,
      description: "Deposit",
      amount: 100,
      reference: null,
      source_type: "manual",
      external_id: null,
      status: "unmatched",
      created_at: "2026-07-24T12:00:00.000Z",
      updated_at: "2026-07-24T12:00:00.000Z",
    };
    const { client, rpcMock } = createBankingRpcMockClient({
      data: transaction,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await createBankTransaction(TEST_ORGANIZATION_ID, {
      bankAccountId: "bank-account-1",
      transactionDate: "2026-07-24",
      amount: 100,
      transactionType: "inbound",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_bank_transaction", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_bank_account_id: "bank-account-1",
      input_transaction_date: "2026-07-24",
      input_amount: 100,
      input_description: null,
      input_transaction_type: "inbound",
    });
    expect(result).toEqual(transaction);
  });
});

describe("matchBankTransaction", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("calls match_bank_transaction RPC", async () => {
    const { client, rpcMock } = createBankingRpcMockClient({
      data: { id: "match-1" },
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await matchBankTransaction(TEST_ORGANIZATION_ID, {
      bankTransactionId: "bank-tx-1",
      matchType: "expense",
      matchedSourceId: "expense-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("match_bank_transaction", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_bank_transaction_id: "bank-tx-1",
      input_match_type: "expense",
      input_matched_source_id: "expense-1",
    });
    expect(result).toEqual({
      bankTransactionId: "bank-tx-1",
      matchId: "match-1",
    });
  });
});
