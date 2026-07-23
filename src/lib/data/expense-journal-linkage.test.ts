import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getExpenseJournalLinkage } from "./expense-journal-linkage";
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

const OTHER_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const TEST_EXPENSE_ID = "66666666-6666-4666-8666-666666666666";
const TEST_JOURNAL_ENTRY_ID = "77777777-7777-4777-8777-777777777777";
const TEST_PERIOD_ID = "88888888-8888-4888-8888-888888888888";

function createRecordedExpenseRow(
  overrides: Partial<{
    status: string;
    journal_entry_id: string | null;
    reference: string | null;
    organization_id: string;
  }> = {},
) {
  return {
    id: TEST_EXPENSE_ID,
    organization_id: TEST_ORGANIZATION_ID,
    status: "recorded",
    journal_entry_id: TEST_JOURNAL_ENTRY_ID,
    reference: "EXP-1001",
    ...overrides,
  };
}

function createJournalRow(
  overrides: Partial<{
    id: string;
    organization_id: string;
    accounting_period_id: string;
    entry_number: string;
    entry_date: string;
    status: string;
  }> = {},
) {
  return {
    id: TEST_JOURNAL_ENTRY_ID,
    organization_id: TEST_ORGANIZATION_ID,
    accounting_period_id: TEST_PERIOD_ID,
    entry_number: "EXP-66666666666646668666666666666666",
    entry_date: "2026-07-05",
    status: "posted",
    ...overrides,
  };
}

function createLinkageMockClient(options: {
  expense?: unknown;
  journal?: unknown;
  period?: unknown;
  lines?: unknown;
  expenseError?: ReturnType<typeof createBackendError> | null;
  journalError?: ReturnType<typeof createBackendError> | null;
  periodError?: ReturnType<typeof createBackendError> | null;
  linesError?: ReturnType<typeof createBackendError> | null;
}) {
  return createMockSupabaseClient({
    expenses: [
      {
        data: options.expenseError ? null : (options.expense ?? []),
        error: options.expenseError ?? null,
      },
    ],
    journal_entries: [
      {
        data: options.journalError ? null : (options.journal ?? []),
        error: options.journalError ?? null,
      },
    ],
    accounting_periods: [
      {
        data: options.periodError ? null : (options.period ?? []),
        error: options.periodError ?? null,
      },
    ],
    journal_entry_lines: [
      {
        data: options.linesError ? null : (options.lines ?? []),
        error: options.linesError ?? null,
      },
    ],
  });
}

function hasFilter(
  query: { filters: { method: string; args: unknown[] }[] },
  method: string,
  args: unknown[],
) {
  return query.filters.some(
    (filter) =>
      filter.method === method &&
      JSON.stringify(filter.args) === JSON.stringify(args),
  );
}

describe("getExpenseJournalLinkage", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("applies organization scope to the expense lookup", async () => {
    const { client, queryLog } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [createJournalRow()],
      period: [{ name: "July 2026" }],
      lines: [
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "100.00",
          credit_amount: "0",
        },
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "0",
          credit_amount: "100.00",
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const expenseQuery = queryLog.find((query) => query.table === "expenses");
    expect(expenseQuery).toBeDefined();
    expect(hasOrganizationFilter(expenseQuery!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(hasFilter(expenseQuery!, "eq", ["id", TEST_EXPENSE_ID])).toBe(true);
  });

  it("applies organization scope to the journal lookup", async () => {
    const { client, queryLog } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [createJournalRow()],
      period: [{ name: "July 2026" }],
      lines: [],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID);

    const journalQuery = queryLog.find(
      (query) => query.table === "journal_entries",
    );
    expect(journalQuery).toBeDefined();
    expect(hasOrganizationFilter(journalQuery!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(
      hasFilter(journalQuery!, "eq", ["id", TEST_JOURNAL_ENTRY_ID]),
    ).toBe(true);
  });

  it("loads line totals only for the organization-scoped journal entry", async () => {
    const { client, queryLog } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [createJournalRow()],
      period: [{ name: "July 2026" }],
      lines: [
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: 50,
          credit_amount: 0,
        },
        {
          journal_entry_id: "99999999-9999-4999-8999-999999999999",
          debit_amount: 999,
          credit_amount: 0,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseJournalLinkage(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    const periodQuery = queryLog.find(
      (query) => query.table === "accounting_periods",
    );
    expect(periodQuery).toBeDefined();
    expect(hasOrganizationFilter(periodQuery!, TEST_ORGANIZATION_ID)).toBe(true);

    const linesQuery = queryLog.find(
      (query) => query.table === "journal_entry_lines",
    );
    expect(linesQuery).toBeDefined();
    expect(
      hasFilter(linesQuery!, "eq", ["journal_entry_id", TEST_JOURNAL_ENTRY_ID]),
    ).toBe(true);
    expect(result?.totalDebit).toBe(50);
    expect(result?.totalCredit).toBe(0);
  });

  it("maps a recorded expense with journal linkage correctly", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow({ reference: "EXP-1001" })],
      journal: [
        createJournalRow({
          entry_number: "EXP-66666666666646668666666666666666",
          entry_date: "2026-07-05",
          status: "posted",
        }),
      ],
      period: [{ name: "July 2026" }],
      lines: [
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "75.25",
          credit_amount: "0",
        },
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "0",
          credit_amount: "75.25",
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).resolves.toEqual({
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
      entryNumber: "EXP-66666666666646668666666666666666",
      entryDate: "2026-07-05",
      status: "posted",
      totalDebit: 75.25,
      totalCredit: 75.25,
      periodName: "July 2026",
      sourceReference: "EXP-1001",
    });
  });

  it("returns null for draft expenses without querying journal linkage", async () => {
    const { client, queryLog } = createLinkageMockClient({
      expense: [
        createRecordedExpenseRow({
          status: "draft",
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).resolves.toBeNull();

    expect(
      queryLog.some((query) => query.table === "journal_entries"),
    ).toBe(false);
    expect(
      queryLog.some((query) => query.table === "journal_entry_lines"),
    ).toBe(false);
  });

  it("returns null when journal_entry_id is null", async () => {
    const { client, queryLog } = createLinkageMockClient({
      expense: [
        createRecordedExpenseRow({
          journal_entry_id: null,
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).resolves.toBeNull();

    expect(
      queryLog.some((query) => query.table === "journal_entries"),
    ).toBe(false);
  });

  it("returns null when no organization-scoped journal entry exists", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).resolves.toBeNull();
  });

  it("maps debit totals using numeric-safe conversion", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [createJournalRow()],
      period: [],
      lines: [
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "10.00",
          credit_amount: "0",
        },
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "5.00",
          credit_amount: "0",
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseJournalLinkage(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result?.totalDebit).toBe(15);
  });

  it("maps credit totals using numeric-safe conversion", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [createJournalRow()],
      period: [],
      lines: [
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "0",
          credit_amount: "20.20",
        },
        {
          journal_entry_id: TEST_JOURNAL_ENTRY_ID,
          debit_amount: "0",
          credit_amount: "4.80",
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseJournalLinkage(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result?.totalCredit).toBe(25);
  });

  it.each(["posted", "draft", "reversed"] as const)(
    "maps journal status %s correctly",
    async (status) => {
      const { client } = createLinkageMockClient({
        expense: [createRecordedExpenseRow()],
        journal: [createJournalRow({ status })],
        period: [],
        lines: [],
      });
      createServerSupabaseClientMock.mockResolvedValue(client);

      const result = await getExpenseJournalLinkage(
        TEST_ORGANIZATION_ID,
        TEST_EXPENSE_ID,
      );

      expect(result?.status).toBe(status);
    },
  );

  it("maps period name when present", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [createJournalRow()],
      period: [{ name: "Q3 2026" }],
      lines: [],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseJournalLinkage(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result?.periodName).toBe("Q3 2026");
  });

  it("maps source reference from the expense when present", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow({ reference: "CHECK-42" })],
      journal: [createJournalRow()],
      period: [],
      lines: [],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseJournalLinkage(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );

    expect(result?.sourceReference).toBe("CHECK-42");
  });

  it("does not expose cross-organization journal entries", async () => {
    const { client } = createLinkageMockClient({
      expense: [createRecordedExpenseRow()],
      journal: [
        createJournalRow({
          organization_id: OTHER_ORGANIZATION_ID,
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).resolves.toBeNull();
  });

  it("throws DataAccessError when repository queries fail", async () => {
    const { client } = createLinkageMockClient({
      expenseError: createBackendError("expense lookup failed"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, TEST_EXPENSE_ID),
    ).rejects.toMatchObject({
      name: "DataAccessError",
      operation: "getExpenseJournalLinkage.expense",
      message: "expense lookup failed",
    });
  });

  it("throws DataAccessError for invalid expenseId", async () => {
    await expect(
      getExpenseJournalLinkage(TEST_ORGANIZATION_ID, "   "),
    ).rejects.toMatchObject({
      name: "DataAccessError",
      operation: "getExpenseJournalLinkage",
      message: "expenseId is required and must be a non-empty string",
    });
  });
});
