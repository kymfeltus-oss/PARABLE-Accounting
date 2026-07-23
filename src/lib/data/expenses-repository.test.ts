import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createExpenseDraft, getExpenseById, getExpenseDraftLines, getExpenseLines, getExpensesData, replaceExpenseDraftLines } from "./expenses-repository";
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

function createCreatedExpenseRow(
  overrides: Partial<{
    id: string;
    vendor_id: string | null;
    reference: string | null;
    payment_source: string;
  }> = {},
) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    organization_id: TEST_ORGANIZATION_ID,
    vendor_id: "vendor-1",
    expense_date: "2026-07-20",
    description: "Office supplies",
    total_amount: 125.75,
    reference: "EXP-2001",
    payment_source: "card",
    status: "draft",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function createExpenseDraftRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyExpensesMockClient();
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

const createExpenseDraftInput = {
  expenseDate: "2026-07-20",
  description: "Office supplies",
  totalAmount: 125.75,
  vendorId: "vendor-1",
  reference: "EXP-2001",
  paymentSource: "card" as const,
};

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

describe("createExpenseDraft", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      createExpenseDraft("", createExpenseDraftInput),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createExpenseDraftRpcMockClient({
      data: createCreatedExpenseRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the create_expense_draft RPC with exact argument names", async () => {
    const { client, rpcMock } = createExpenseDraftRpcMockClient({
      data: createCreatedExpenseRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("create_expense_draft", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_expense_date: "2026-07-20",
      input_description: "Office supplies",
      input_total_amount: 125.75,
      input_vendor_id: "vendor-1",
      input_reference: "EXP-2001",
      input_payment_source: "card",
    });
  });

  it("maps omitted vendorId and reference to null in the RPC payload", async () => {
    const { client, rpcMock } = createExpenseDraftRpcMockClient({
      data: createCreatedExpenseRow({
        vendor_id: null,
        reference: null,
      }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createExpenseDraft(TEST_ORGANIZATION_ID, {
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: 125.75,
      paymentSource: "other",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_expense_draft", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_expense_date: "2026-07-20",
      input_description: "Office supplies",
      input_total_amount: 125.75,
      input_vendor_id: null,
      input_reference: null,
      input_payment_source: "other",
    });
  });

  it("uses organizationId only from the separate argument", async () => {
    const { client, rpcMock } = createExpenseDraftRpcMockClient({
      data: createCreatedExpenseRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput);

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs.target_organization_id).toBe(TEST_ORGANIZATION_ID);
    expect(rpcArgs).not.toHaveProperty("organization_id");
  });

  it("never sends status, actor_user_id, line, or journal data to the RPC", async () => {
    const { client, rpcMock } = createExpenseDraftRpcMockClient({
      data: createCreatedExpenseRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput);

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs).not.toHaveProperty("status");
    expect(rpcArgs).not.toHaveProperty("actor_user_id");
    expect(rpcArgs).not.toHaveProperty("expense_lines");
    expect(rpcArgs).not.toHaveProperty("journal_entry_id");
    expect(rpcArgs).not.toHaveProperty("journal_entries");
    expect(rpcArgs).not.toHaveProperty("journal_entry_lines");
  });

  it("does not perform a direct expenses table insert, update, or delete", async () => {
    const { client, fromMock } = createExpenseDraftRpcMockClient({
      data: createCreatedExpenseRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput);

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the created expense row from the RPC", async () => {
    const createdRow = createCreatedExpenseRow();
    const { client } = createExpenseDraftRpcMockClient({
      data: createdRow,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await createExpenseDraft(
      TEST_ORGANIZATION_ID,
      createExpenseDraftInput,
    );

    expect(result).toEqual(createdRow);
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createExpenseDraftRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to create draft expense"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("logs development-only RPC diagnostics without sensitive auth data", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpcError = createBackendError("Insufficient role to create draft expense");
    rpcError.details = "Role check failed";
    rpcError.hint = "Verify membership role";

    vi.stubEnv("NODE_ENV", "development");

    const { client } = createExpenseDraftRpcMockClient({
      data: null,
      error: rpcError,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput),
    ).rejects.toBeInstanceOf(DataAccessError);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe(
      "[createExpenseDraft RPC diagnostic]",
    );
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toEqual({
      operation: "createExpenseDraft",
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      organizationId: TEST_ORGANIZATION_ID,
      expenseDate: "2026-07-20",
      hasVendorId: true,
      paymentSource: "card",
    });

    const diagnosticPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(diagnosticPayload).not.toMatch(/token|cookie|authorization|password|secret|anon_key|service_role/i);

    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("does not log RPC diagnostics outside development", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubEnv("NODE_ENV", "production");

    const { client } = createExpenseDraftRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to create draft expense"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput),
    ).rejects.toBeInstanceOf(DataAccessError);

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("throws DataAccessError when the RPC returns no row", async () => {
    const { client } = createExpenseDraftRpcMockClient({
      data: null,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createExpenseDraft(TEST_ORGANIZATION_ID, createExpenseDraftInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

const TEST_EXPENSE_ID = "66666666-6666-4666-8666-666666666666";
const TEST_ACCOUNT_ID_1 = "77777777-7777-4777-8777-777777777771";
const TEST_ACCOUNT_ID_2 = "77777777-7777-4777-8777-777777777772";
const TEST_FUND_ID = "88888888-8888-4888-8888-888888888888";

const replaceExpenseDraftLinesInput = {
  expenseId: TEST_EXPENSE_ID,
  lines: [
    {
      accountId: TEST_ACCOUNT_ID_1,
      fundId: TEST_FUND_ID,
      amount: 85.5,
      description: "Office supplies",
    },
    {
      accountId: TEST_ACCOUNT_ID_2,
      amount: 40.25,
    },
  ],
};

function createReplaceExpenseDraftLinesRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyExpensesMockClient();
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

describe("replaceExpenseDraftLines", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      replaceExpenseDraftLines("", replaceExpenseDraftLinesInput),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createReplaceExpenseDraftLinesRpcMockClient({
      data: createCreatedExpenseRow({ id: TEST_EXPENSE_ID, total_amount: 125.75 }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await replaceExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      replaceExpenseDraftLinesInput,
    );

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls replace_expense_draft_lines with exact RPC arguments and mapped lines", async () => {
    const { client, rpcMock } = createReplaceExpenseDraftLinesRpcMockClient({
      data: createCreatedExpenseRow({ id: TEST_EXPENSE_ID, total_amount: 125.75 }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await replaceExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      replaceExpenseDraftLinesInput,
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("replace_expense_draft_lines", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_expense_id: TEST_EXPENSE_ID,
      input_lines: [
        {
          account_id: TEST_ACCOUNT_ID_1,
          fund_id: TEST_FUND_ID,
          amount: 85.5,
          description: "Office supplies",
        },
        {
          account_id: TEST_ACCOUNT_ID_2,
          fund_id: null,
          amount: 40.25,
          description: null,
        },
      ],
    });
  });

  it("maps omitted fundId and description to null while preserving explicit null values", async () => {
    const { client, rpcMock } = createReplaceExpenseDraftLinesRpcMockClient({
      data: createCreatedExpenseRow({ id: TEST_EXPENSE_ID }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await replaceExpenseDraftLines(TEST_ORGANIZATION_ID, {
      expenseId: TEST_EXPENSE_ID,
      lines: [
        {
          accountId: TEST_ACCOUNT_ID_1,
          fundId: null,
          amount: 10,
          description: null,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          amount: 20,
        },
      ],
    });

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as {
      input_lines: Array<Record<string, unknown>>;
    };

    expect(rpcArgs.input_lines[0]).toEqual({
      account_id: TEST_ACCOUNT_ID_1,
      fund_id: null,
      amount: 10,
      description: null,
    });
    expect(rpcArgs.input_lines[1]).toEqual({
      account_id: TEST_ACCOUNT_ID_2,
      fund_id: null,
      amount: 20,
      description: null,
    });
  });

  it("preserves line array order in input_lines", async () => {
    const { client, rpcMock } = createReplaceExpenseDraftLinesRpcMockClient({
      data: createCreatedExpenseRow({ id: TEST_EXPENSE_ID }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await replaceExpenseDraftLines(TEST_ORGANIZATION_ID, {
      expenseId: TEST_EXPENSE_ID,
      lines: [
        { accountId: "account-first", amount: 1 },
        { accountId: "account-second", amount: 2 },
        { accountId: "account-third", amount: 3 },
      ],
    });

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as {
      input_lines: Array<{ account_id: string; amount: number }>;
    };

    expect(Array.isArray(rpcArgs.input_lines)).toBe(true);
    expect(rpcArgs.input_lines.map((line) => line.account_id)).toEqual([
      "account-first",
      "account-second",
      "account-third",
    ]);
    expect(rpcArgs.input_lines.map((line) => line.amount)).toEqual([1, 2, 3]);
  });

  it("never sends line_number, line id, organization_id, expense_id, total_amount, status, or journal fields", async () => {
    const { client, rpcMock } = createReplaceExpenseDraftLinesRpcMockClient({
      data: createCreatedExpenseRow({ id: TEST_EXPENSE_ID }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await replaceExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      replaceExpenseDraftLinesInput,
    );

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs).not.toHaveProperty("organization_id");
    expect(rpcArgs).not.toHaveProperty("total_amount");
    expect(rpcArgs).not.toHaveProperty("status");
    expect(rpcArgs).not.toHaveProperty("journal_entry_id");
    expect(rpcArgs).not.toHaveProperty("journal_entries");
    expect(rpcArgs).not.toHaveProperty("journal_entry_lines");

    for (const line of rpcArgs.input_lines as Array<Record<string, unknown>>) {
      expect(line).not.toHaveProperty("line_number");
      expect(line).not.toHaveProperty("id");
      expect(line).not.toHaveProperty("organization_id");
      expect(line).not.toHaveProperty("expense_id");
      expect(line).not.toHaveProperty("total_amount");
      expect(line).not.toHaveProperty("status");
      expect(line).not.toHaveProperty("journal_entry_id");
    }
  });

  it("does not perform direct expense_lines or journal table mutations", async () => {
    const { client, fromMock } = createReplaceExpenseDraftLinesRpcMockClient({
      data: createCreatedExpenseRow({ id: TEST_EXPENSE_ID }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await replaceExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      replaceExpenseDraftLinesInput,
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the updated expense row from the RPC", async () => {
    const updatedRow = createCreatedExpenseRow({
      id: TEST_EXPENSE_ID,
      total_amount: 125.75,
    });
    const { client } = createReplaceExpenseDraftLinesRpcMockClient({
      data: updatedRow,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await replaceExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      replaceExpenseDraftLinesInput,
    );

    expect(result).toEqual(updatedRow);
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createReplaceExpenseDraftLinesRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to replace expense draft lines"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      replaceExpenseDraftLines(TEST_ORGANIZATION_ID, replaceExpenseDraftLinesInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("throws DataAccessError when the RPC returns no row", async () => {
    const { client } = createReplaceExpenseDraftLinesRpcMockClient({
      data: null,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      replaceExpenseDraftLines(TEST_ORGANIZATION_ID, replaceExpenseDraftLinesInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("logs development-only RPC diagnostics without secrets or full payloads", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpcError = createBackendError(
      "Insufficient role to replace expense draft lines",
    );
    rpcError.details = "Role check failed";
    rpcError.hint = "Verify membership role";

    vi.stubEnv("NODE_ENV", "development");

    const { client } = createReplaceExpenseDraftLinesRpcMockClient({
      data: null,
      error: rpcError,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      replaceExpenseDraftLines(TEST_ORGANIZATION_ID, replaceExpenseDraftLinesInput),
    ).rejects.toBeInstanceOf(DataAccessError);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe(
      "[replaceExpenseDraftLines RPC diagnostic]",
    );
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toEqual({
      operation: "replaceExpenseDraftLines",
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      organizationId: TEST_ORGANIZATION_ID,
      expenseId: TEST_EXPENSE_ID,
      lineCount: 2,
    });

    const diagnosticPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(diagnosticPayload).not.toMatch(
      /token|cookie|authorization|password|secret|anon_key|service_role|account_id|input_lines/i,
    );

    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

function createExpenseLineRow(
  overrides: Partial<{
    id: string;
    expense_id: string;
    account_id: string;
    fund_id: string | null;
    line_number: number;
    description: string | null;
    amount: number | string;
  }> = {},
) {
  return {
    id: "99999999-9999-4999-8999-999999999991",
    expense_id: TEST_EXPENSE_ID,
    account_id: TEST_ACCOUNT_ID_1,
    fund_id: TEST_FUND_ID,
    line_number: 1,
    description: "Office supplies",
    amount: 85.5,
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function createGetExpenseDraftLinesMockClient(
  tableQueues: Parameters<typeof createMockSupabaseClient>[0] = {},
) {
  const { client, queryLog } = createMockSupabaseClient(tableQueues);
  const fromMock = vi.spyOn(client, "from");

  return { client, queryLog, fromMock };
}

describe("getExpenseDraftLines", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      getExpenseDraftLines("", TEST_EXPENSE_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("requires expenseId", async () => {
    await expect(
      getExpenseDraftLines(TEST_ORGANIZATION_ID, "   "),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("looks up the parent expense before querying expense lines", async () => {
    const { client, queryLog } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    expect(queryLog[0]?.table).toBe("expenses");
    expect(queryLog[1]?.table).toBe("expense_lines");
  });

  it("filters the parent expense by organization_id and expense id", async () => {
    const { client, queryLog } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const expenseQuery = queryLog.find((query) => query.table === "expenses");
    expect(expenseQuery).toBeDefined();
    expect(hasOrganizationFilter(expenseQuery!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(expenseQuery?.filters).toContainEqual({
      method: "eq",
      args: ["id", TEST_EXPENSE_ID],
    });
  });

  it("throws DataAccessError when the parent expense is missing", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("throws DataAccessError when the parent expense lookup fails", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: null, error: createBackendError("expense lookup failed") }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("queries expense lines by expense_id ordered by line_number ascending", async () => {
    const { client, queryLog } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const lineQuery = queryLog.find((query) => query.table === "expense_lines");
    expect(lineQuery?.filters).toContainEqual({
      method: "eq",
      args: ["expense_id", TEST_EXPENSE_ID],
    });
    expect(lineQuery?.filters).toContainEqual({
      method: "order",
      args: ["line_number", { ascending: true }],
    });
  });

  it("returns an empty array for a valid expense with zero lines", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result).toEqual([]);
  });

  it("maps one expense line to application detail fields", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [createExpenseLineRow()], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result).toEqual([
      {
        id: "99999999-9999-4999-8999-999999999991",
        expenseId: TEST_EXPENSE_ID,
        accountId: TEST_ACCOUNT_ID_1,
        fundId: TEST_FUND_ID,
        lineNumber: 1,
        description: "Office supplies",
        amount: 85.5,
      },
    ]);
    expect(result[0]).not.toHaveProperty("created_at");
    expect(result[0]).not.toHaveProperty("updated_at");
  });

  it("preserves multiple line order and maps nullable fund and description values", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [
        {
          data: [
            createExpenseLineRow({
              id: "99999999-9999-4999-8999-999999999991",
              line_number: 1,
              fund_id: TEST_FUND_ID,
              description: "First line",
              amount: "10.50",
            }),
            createExpenseLineRow({
              id: "99999999-9999-4999-8999-999999999992",
              account_id: TEST_ACCOUNT_ID_2,
              fund_id: null,
              line_number: 2,
              description: null,
              amount: 20,
            }),
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseDraftLines(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result).toEqual([
      {
        id: "99999999-9999-4999-8999-999999999991",
        expenseId: TEST_EXPENSE_ID,
        accountId: TEST_ACCOUNT_ID_1,
        fundId: TEST_FUND_ID,
        lineNumber: 1,
        description: "First line",
        amount: 10.5,
      },
      {
        id: "99999999-9999-4999-8999-999999999992",
        expenseId: TEST_EXPENSE_ID,
        accountId: TEST_ACCOUNT_ID_2,
        fundId: null,
        lineNumber: 2,
        description: null,
        amount: 20,
      },
    ]);
  });

  it("throws DataAccessError when the expense line query fails", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [
        { data: null, error: createBackendError("expense line query failed") },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("does not perform direct table mutations or journal queries", async () => {
    const { client, fromMock } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseDraftLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(fromMock.mock.calls.map((call) => call[0])).toEqual([
      "expenses",
      "expense_lines",
    ]);
    expect(fromMock.mock.calls.map((call) => call[0])).not.toContain(
      "journal_entries",
    );
    expect(fromMock.mock.calls.map((call) => call[0])).not.toContain(
      "journal_entry_lines",
    );
  });
});

describe("getExpenseById", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getExpenseById("", TEST_EXPENSE_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("requires expenseId", async () => {
    await expect(getExpenseById(TEST_ORGANIZATION_ID, "   ")).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters by organization_id and expense id", async () => {
    const expenseRow = createCreatedExpenseRow({ id: TEST_EXPENSE_ID });
    const { client, queryLog } = createMockSupabaseClient({
      expenses: [{ data: [expenseRow], error: null }],
      vendors: [{ data: [{ name: "Northside Supplies" }], error: null }],
      expense_lines: [{ data: [{ expense_id: TEST_EXPENSE_ID }], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseById(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const expenseQuery = queryLog.find((query) => query.table === "expenses");
    expect(expenseQuery).toBeDefined();
    expect(hasOrganizationFilter(expenseQuery!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(expenseQuery?.filters).toContainEqual({
      method: "eq",
      args: ["id", TEST_EXPENSE_ID],
    });
  });

  it("returns a mapped expense when found", async () => {
    const expenseRow = createCreatedExpenseRow({ id: TEST_EXPENSE_ID });
    const { client } = createMockSupabaseClient({
      expenses: [{ data: [expenseRow], error: null }],
      vendors: [{ data: [{ name: "Northside Supplies" }], error: null }],
      expense_lines: [
        { data: [{ expense_id: TEST_EXPENSE_ID }, { expense_id: TEST_EXPENSE_ID }], error: null },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseById(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    expect(result).toEqual({
      ...expenseRow,
      vendorName: "Northside Supplies",
      lineCount: 2,
    });
  });

  it("returns null when no matching row exists", async () => {
    const { client } = createMockSupabaseClient({
      expenses: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseById(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    expect(result).toBeNull();
  });

  it("handles repository errors using existing conventions", async () => {
    const { client } = createMockSupabaseClient({
      expenses: [
        { data: null, error: createBackendError("expense query failed") },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseById(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("never performs an id-only lookup", async () => {
    const expenseRow = createCreatedExpenseRow({ id: TEST_EXPENSE_ID });
    const { client, queryLog } = createMockSupabaseClient({
      expenses: [{ data: [expenseRow], error: null }],
      vendors: [{ data: [], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseById(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const expenseQuery = queryLog.find((query) => query.table === "expenses");
    expect(expenseQuery?.filters.some(
      (filter) =>
        filter.method === "eq" &&
        filter.args[0] === "organization_id" &&
        filter.args[1] === TEST_ORGANIZATION_ID,
    )).toBe(true);
    expect(expenseQuery?.filters.some(
      (filter) =>
        filter.method === "eq" &&
        filter.args[0] === "id" &&
        filter.args[1] === TEST_EXPENSE_ID,
    )).toBe(true);
  });
});

describe("getExpenseLines", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("filters the parent expense by organization_id and expense id", async () => {
    const { client, queryLog } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const expenseQuery = queryLog.find((query) => query.table === "expenses");
    expect(expenseQuery).toBeDefined();
    expect(hasOrganizationFilter(expenseQuery!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(expenseQuery?.filters).toContainEqual({
      method: "eq",
      args: ["id", TEST_EXPENSE_ID],
    });
  });

  it("returns mapped allocation lines ordered by line number", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [{ id: TEST_EXPENSE_ID }], error: null }],
      expense_lines: [
        {
          data: [
            {
              id: "line-1",
              expense_id: TEST_EXPENSE_ID,
              account_id: "acct-1",
              fund_id: "fund-1",
              line_number: 1,
              description: "Utilities",
              amount: 50,
              created_at: "2026-07-20T12:00:00.000Z",
              updated_at: "2026-07-20T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    expect(result).toEqual([
      {
        id: "line-1",
        expenseId: TEST_EXPENSE_ID,
        accountId: "acct-1",
        fundId: "fund-1",
        lineNumber: 1,
        description: "Utilities",
        amount: 50,
      },
    ]);
  });

  it("throws DataAccessError when the parent expense is missing", async () => {
    const { client } = createGetExpenseDraftLinesMockClient({
      expenses: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseLines(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
