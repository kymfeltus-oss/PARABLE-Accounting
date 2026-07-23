import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getJournalEntryDetail } from "./journal-entry-detail-repository";
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
const JOURNAL_ENTRY_ID = "77777777-7777-4777-8777-777777777777";
const PERIOD_ID = "88888888-8888-4888-8888-888888888888";
const ACCOUNT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FUND_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXPENSE_ID = "66666666-6666-4666-8666-666666666666";
const LINE_ONE_ID = "11111111-1111-4111-8111-111111111111";
const LINE_TWO_ID = "22222222-2222-4222-8222-222222222222";

function createJournalRow(
  overrides: Partial<{
    id: string;
    organization_id: string;
    accounting_period_id: string;
    entry_number: string;
    entry_date: string;
    description: string;
    source_type: string;
    source_id: string | null;
    status: string;
  }> = {},
) {
  return {
    id: JOURNAL_ENTRY_ID,
    organization_id: TEST_ORGANIZATION_ID,
    accounting_period_id: PERIOD_ID,
    entry_number: "JE-2026-0042",
    entry_date: "2026-07-23",
    description: "Recorded community outreach expense",
    source_type: "expense",
    source_id: EXPENSE_ID,
    status: "posted",
    ...overrides,
  };
}

function createDetailMockClient(options: {
  journal?: ReturnType<typeof createJournalRow>[];
  lines?: Array<{
    id: string;
    journal_entry_id: string;
    account_id: string;
    fund_id: string | null;
    line_number: number;
    description: string | null;
    debit_amount: number | string;
    credit_amount: number | string;
  }>;
  periods?: Array<{ id: string; name: string; organization_id: string }>;
  accounts?: Array<{
    id: string;
    organization_id: string;
    code: string;
    name: string;
  }>;
  funds?: Array<{
    id: string;
    organization_id: string;
    code: string;
    name: string;
  }>;
  expenses?: Array<{ id: string; reference: string | null }>;
  journalError?: ReturnType<typeof createBackendError> | null;
}) {
  return createMockSupabaseClient({
    journal_entries: [
      {
        data: options.journalError ? null : (options.journal ?? []),
        error: options.journalError ?? null,
      },
    ],
    journal_entry_lines: [
      {
        data: options.lines ?? [
          {
            id: LINE_TWO_ID,
            journal_entry_id: JOURNAL_ENTRY_ID,
            account_id: ACCOUNT_ID,
            fund_id: FUND_ID,
            line_number: 2,
            description: null,
            debit_amount: "0",
            credit_amount: "1250.50",
          },
          {
            id: LINE_ONE_ID,
            journal_entry_id: JOURNAL_ENTRY_ID,
            account_id: ACCOUNT_ID,
            fund_id: FUND_ID,
            line_number: 1,
            description: "Outreach supplies",
            debit_amount: "1250.50",
            credit_amount: "0",
          },
        ],
        error: null,
      },
    ],
    accounting_periods: [
      {
        data: options.periods ?? [
          {
            id: PERIOD_ID,
            name: "July 2026",
            organization_id: TEST_ORGANIZATION_ID,
          },
        ],
        error: null,
      },
    ],
    accounts: [
      {
        data: options.accounts ?? [
          {
            id: ACCOUNT_ID,
            organization_id: TEST_ORGANIZATION_ID,
            code: "5100",
            name: "Community Outreach Expense",
          },
        ],
        error: null,
      },
    ],
    funds: [
      {
        data: options.funds ?? [
          {
            id: FUND_ID,
            organization_id: TEST_ORGANIZATION_ID,
            code: "GEN",
            name: "General Fund",
          },
        ],
        error: null,
      },
    ],
    expenses: [
      {
        data: options.expenses ?? [
          {
            id: EXPENSE_ID,
            reference: "EXP-1042",
          },
        ],
        error: null,
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

describe("getJournalEntryDetail", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("scopes journal lookup by organization and id", async () => {
    const { client, queryLog } = createDetailMockClient({
      journal: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID);

    const journalQuery = queryLog.find(
      (query) => query.table === "journal_entries",
    );
    expect(journalQuery).toBeDefined();
    expect(hasOrganizationFilter(journalQuery!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(
      hasFilter(journalQuery!, "eq", ["id", JOURNAL_ENTRY_ID]),
    ).toBe(true);
  });

  it("returns null when the scoped journal is missing", async () => {
    const { client } = createDetailMockClient({ journal: [] });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toBeNull();
  });

  it("excludes cross-organization journals", async () => {
    const { client } = createDetailMockClient({
      journal: [createJournalRow({ organization_id: OTHER_ORGANIZATION_ID })],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toBeNull();
  });

  it("scopes lines to the organization-scoped journal", async () => {
    const { client, queryLog } = createDetailMockClient({
      journal: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID);

    const linesQuery = queryLog.find(
      (query) => query.table === "journal_entry_lines",
    );
    expect(linesQuery).toBeDefined();
    expect(
      hasFilter(linesQuery!, "eq", ["journal_entry_id", JOURNAL_ENTRY_ID]),
    ).toBe(true);
  });

  it("scopes accounts and funds by organization", async () => {
    const { client, queryLog } = createDetailMockClient({
      journal: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID);

    const accountsQuery = queryLog.find((query) => query.table === "accounts");
    const fundsQuery = queryLog.find((query) => query.table === "funds");
    expect(hasOrganizationFilter(accountsQuery!, TEST_ORGANIZATION_ID)).toBe(
      true,
    );
    expect(hasOrganizationFilter(fundsQuery!, TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("scopes accounting period lookup by organization", async () => {
    const { client, queryLog } = createDetailMockClient({
      journal: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID);

    const periodQuery = queryLog.find(
      (query) => query.table === "accounting_periods",
    );
    expect(hasOrganizationFilter(periodQuery!, TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("excludes cross-organization account and fund data", async () => {
    const { client } = createDetailMockClient({
      journal: [createJournalRow()],
      accounts: [
        {
          id: ACCOUNT_ID,
          organization_id: OTHER_ORGANIZATION_ID,
          code: "9999",
          name: "Other Org Account",
        },
      ],
      funds: [
        {
          id: FUND_ID,
          organization_id: OTHER_ORGANIZATION_ID,
          code: "OTH",
          name: "Other Org Fund",
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalEntryDetail(
      TEST_ORGANIZATION_ID,
      JOURNAL_ENTRY_ID,
    );

    expect(result?.lines[0]?.accountCode).toBe("");
    expect(result?.lines[0]?.accountName).toBe("");
    expect(result?.lines[0]?.fundCode).toBeNull();
    expect(result?.lines[0]?.fundName).toBeNull();
  });

  it("maps source, source reference, and period name correctly", async () => {
    const { client } = createDetailMockClient({
      journal: [createJournalRow({ source_type: "expense" })],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalEntryDetail(
      TEST_ORGANIZATION_ID,
      JOURNAL_ENTRY_ID,
    );

    expect(result?.source).toBe("expense");
    expect(result?.sourceReference).toBe("EXP-1042");
    expect(result?.periodName).toBe("July 2026");
  });

  it("maps unknown source types to other and keeps missing period null", async () => {
    const unknownSourceClient = createDetailMockClient({
      journal: [createJournalRow({ source_type: "bill", source_id: null })],
    }).client;
    createServerSupabaseClientMock.mockResolvedValue(unknownSourceClient);

    const unknownSource = await getJournalEntryDetail(
      TEST_ORGANIZATION_ID,
      JOURNAL_ENTRY_ID,
    );
    expect(unknownSource?.source).toBe("other");
    expect(unknownSource?.sourceReference).toBeNull();

    const missingPeriodClient = createDetailMockClient({
      journal: [createJournalRow({ accounting_period_id: "missing-period" })],
      periods: [],
    }).client;
    createServerSupabaseClientMock.mockResolvedValue(missingPeriodClient);

    const missingPeriod = await getJournalEntryDetail(
      TEST_ORGANIZATION_ID,
      JOURNAL_ENTRY_ID,
    );
    expect(missingPeriod?.periodName).toBeNull();
  });

  it("maps account, fund, description, and amounts correctly", async () => {
    const { client } = createDetailMockClient({
      journal: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalEntryDetail(
      TEST_ORGANIZATION_ID,
      JOURNAL_ENTRY_ID,
    );

    expect(result?.lines).toHaveLength(2);
    expect(result?.lines[0]).toMatchObject({
      id: LINE_ONE_ID,
      lineNumber: 1,
      accountCode: "5100",
      accountName: "Community Outreach Expense",
      description: "Outreach supplies",
      debit: 1250.5,
      credit: 0,
      fundCode: "GEN",
      fundName: "General Fund",
    });
    expect(result?.lines[1]?.lineNumber).toBe(2);
    expect(result?.lines[1]?.description).toBeNull();
  });

  it("sorts lines by line number", async () => {
    const { client } = createDetailMockClient({
      journal: [createJournalRow()],
      lines: [
        {
          id: LINE_TWO_ID,
          journal_entry_id: JOURNAL_ENTRY_ID,
          account_id: ACCOUNT_ID,
          fund_id: null,
          line_number: 2,
          description: null,
          debit_amount: 0,
          credit_amount: 10,
        },
        {
          id: LINE_ONE_ID,
          journal_entry_id: JOURNAL_ENTRY_ID,
          account_id: ACCOUNT_ID,
          fund_id: null,
          line_number: 1,
          description: null,
          debit_amount: 10,
          credit_amount: 0,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalEntryDetail(
      TEST_ORGANIZATION_ID,
      JOURNAL_ENTRY_ID,
    );

    expect(result?.lines.map((line) => line.lineNumber)).toEqual([1, 2]);
  });

  it("throws DataAccessError when repository queries fail", async () => {
    const { client } = createDetailMockClient({
      journalError: createBackendError("journal lookup failed"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).rejects.toMatchObject({
      name: "DataAccessError",
      operation: "getJournalEntryDetail.journal",
      message: "journal lookup failed",
    });
  });

  it("does not use service-role access", async () => {
    const { client } = createDetailMockClient({
      journal: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalEntryDetail(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
  });
});
