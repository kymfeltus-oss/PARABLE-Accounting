import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  clampJournalRegisterPage,
  clampJournalRegisterPageSize,
  getJournalRegister,
  mapDatabaseSourceType,
  normalizeJournalRegisterSource,
  normalizeJournalRegisterStatus,
  resolveDatabaseSourceTypes,
} from "./journal-register-repository";
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
const PERIOD_ID = "88888888-8888-4888-8888-888888888888";
const EXPENSE_ID = "66666666-6666-4666-8666-666666666666";

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
    id: "77777777-7777-4777-8777-777777777777",
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

function createRegisterMockClient(options: {
  journals?: ReturnType<typeof createJournalRow>[];
  periods?: Array<{ id: string; name: string; organization_id: string }>;
  lines?: Array<{
    journal_entry_id: string;
    debit_amount: number | string;
    credit_amount: number | string;
  }>;
  expenses?: Array<{ id: string; reference: string | null }>;
  journalError?: ReturnType<typeof createBackendError> | null;
}) {
  return createMockSupabaseClient({
    journal_entries: [
      {
        data: options.journalError ? null : (options.journals ?? []),
        error: options.journalError ?? null,
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
    journal_entry_lines: [
      {
        data: options.lines ?? [
          {
            journal_entry_id: "77777777-7777-4777-8777-777777777777",
            debit_amount: "1250.50",
            credit_amount: "0",
          },
          {
            journal_entry_id: "77777777-7777-4777-8777-777777777777",
            debit_amount: "0",
            credit_amount: "1250.50",
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

describe("journal register normalization helpers", () => {
  it("clamps page values safely", () => {
    expect(clampJournalRegisterPage(undefined)).toBe(1);
    expect(clampJournalRegisterPage(0)).toBe(1);
    expect(clampJournalRegisterPage(2.9)).toBe(2);
  });

  it("clamps pageSize values safely", () => {
    expect(clampJournalRegisterPageSize(undefined)).toBe(25);
    expect(clampJournalRegisterPageSize(0)).toBe(25);
    expect(clampJournalRegisterPageSize(500)).toBe(100);
  });

  it("falls back invalid status and source filters safely", () => {
    expect(normalizeJournalRegisterStatus("invalid")).toBe("all");
    expect(normalizeJournalRegisterSource("invalid")).toBe("all");
  });

  it("maps unknown database sources to other", () => {
    expect(mapDatabaseSourceType("bill")).toBe("other");
    expect(resolveDatabaseSourceTypes("other")).toEqual([
      "bill",
      "adjustment",
      "closing",
    ]);
  });
});

describe("getJournalRegister", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("applies organization scope to journal reads", async () => {
    const { client, queryLog } = createRegisterMockClient({
      journals: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalRegister(TEST_ORGANIZATION_ID, {});

    const journalQuery = queryLog.find(
      (query) => query.table === "journal_entries",
    );
    expect(journalQuery).toBeDefined();
    expect(hasOrganizationFilter(journalQuery!, TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("applies organization scope to accounting period reads", async () => {
    const { client, queryLog } = createRegisterMockClient({
      journals: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalRegister(TEST_ORGANIZATION_ID, {});

    const periodQuery = queryLog.find(
      (query) => query.table === "accounting_periods",
    );
    expect(periodQuery).toBeDefined();
    expect(hasOrganizationFilter(periodQuery!, TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("loads line totals only for organization-scoped journal ids", async () => {
    const journalId = "77777777-7777-4777-8777-777777777777";
    const { client, queryLog } = createRegisterMockClient({
      journals: [createJournalRow({ id: journalId })],
      lines: [
        {
          journal_entry_id: journalId,
          debit_amount: 100,
          credit_amount: 0,
        },
        {
          journal_entry_id: "99999999-9999-4999-8999-999999999999",
          debit_amount: 500,
          credit_amount: 0,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

    const linesQuery = queryLog.find(
      (query) => query.table === "journal_entry_lines",
    );
    expect(linesQuery).toBeDefined();
    expect(hasFilter(linesQuery!, "in", ["journal_entry_id", [journalId]])).toBe(
      true,
    );
    expect(result.entries[0]?.totalDebit).toBe(100);
    expect(result.entries[0]?.totalCredit).toBe(0);
  });

  it("excludes cross-organization journals", async () => {
    const { client } = createRegisterMockClient({
      journals: [
        createJournalRow({
          organization_id: OTHER_ORGANIZATION_ID,
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

    expect(result.entries).toEqual([]);
  });

  it("maps debit and credit totals correctly", async () => {
    const { client } = createRegisterMockClient({
      journals: [createJournalRow()],
      lines: [
        {
          journal_entry_id: "77777777-7777-4777-8777-777777777777",
          debit_amount: "10.00",
          credit_amount: "0",
        },
        {
          journal_entry_id: "77777777-7777-4777-8777-777777777777",
          debit_amount: "5.00",
          credit_amount: "0",
        },
        {
          journal_entry_id: "77777777-7777-4777-8777-777777777777",
          debit_amount: "0",
          credit_amount: "15.00",
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

    expect(result.entries[0]?.totalDebit).toBe(15);
    expect(result.entries[0]?.totalCredit).toBe(15);
  });

  it.each(["posted", "draft", "reversed"] as const)(
    "maps journal status %s correctly",
    async (status) => {
      const { client } = createRegisterMockClient({
        journals: [createJournalRow({ status })],
      });
      createServerSupabaseClientMock.mockResolvedValue(client);

      const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

      expect(result.entries[0]?.status).toBe(status);
    },
  );

  it("maps expense source and source reference correctly", async () => {
    const { client } = createRegisterMockClient({
      journals: [createJournalRow({ source_type: "expense" })],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

    expect(result.entries[0]?.source).toBe("expense");
    expect(result.entries[0]?.sourceReference).toBe("EXP-1042");
  });

  it("maps unknown database source types to other", async () => {
    const { client } = createRegisterMockClient({
      journals: [createJournalRow({ source_type: "bill", source_id: null })],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

    expect(result.entries[0]?.source).toBe("other");
  });

  it("maps period name and keeps missing period null", async () => {
    const withPeriodClient = createRegisterMockClient({
      journals: [createJournalRow()],
    }).client;
    createServerSupabaseClientMock.mockResolvedValue(withPeriodClient);

    const withPeriod = await getJournalRegister(TEST_ORGANIZATION_ID, {});
    expect(withPeriod.entries[0]?.periodName).toBe("July 2026");

    const withoutPeriodClient = createRegisterMockClient({
      journals: [createJournalRow({ accounting_period_id: "missing-period" })],
      periods: [],
    }).client;
    createServerSupabaseClientMock.mockResolvedValue(withoutPeriodClient);

    const withoutPeriod = await getJournalRegister(TEST_ORGANIZATION_ID, {});
    expect(withoutPeriod.entries[0]?.periodName).toBeNull();
  });

  it("applies search safely across supported fields", async () => {
    const { client } = createRegisterMockClient({
      journals: [
        createJournalRow({
          id: "11111111-1111-4111-8111-111111111111",
          entry_number: "JE-ALPHA",
          description: "Alpha entry",
        }),
        createJournalRow({
          id: "22222222-2222-4222-8222-222222222222",
          entry_number: "JE-BETA",
          description: "Beta entry",
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {
      search: "alpha",
    });

    expect(result.totalCount).toBe(1);
    expect(result.entries[0]?.entryNumber).toBe("JE-ALPHA");
  });

  it("applies status and source filters", async () => {
    const { client, queryLog } = createRegisterMockClient({
      journals: [createJournalRow({ status: "posted", source_type: "manual" })],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalRegister(TEST_ORGANIZATION_ID, {
      status: "posted",
      source: "manual",
    });

    const journalQuery = queryLog.find(
      (query) => query.table === "journal_entries",
    );
    expect(hasFilter(journalQuery!, "eq", ["status", "posted"])).toBe(true);
    expect(
      hasFilter(journalQuery!, "in", ["source_type", ["manual"]]),
    ).toBe(true);
  });

  it("applies deterministic ordering", async () => {
    const { client } = createRegisterMockClient({
      journals: [
        createJournalRow({
          id: "11111111-1111-4111-8111-111111111111",
          entry_date: "2026-07-20",
          entry_number: "JE-002",
        }),
        createJournalRow({
          id: "22222222-2222-4222-8222-222222222222",
          entry_date: "2026-07-23",
          entry_number: "JE-001",
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {});

    expect(result.entries.map((entry) => entry.id)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("maps total count and paginates results", async () => {
    const journals = Array.from({ length: 3 }, (_, index) =>
      createJournalRow({
        id: `${index + 1}1111111-1111-4111-8111-111111111111`,
        entry_number: `JE-00${index + 1}`,
        entry_date: `2026-07-${20 + index}`,
      }),
    );
    const { client } = createRegisterMockClient({ journals });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getJournalRegister(TEST_ORGANIZATION_ID, {
      page: 2,
      pageSize: 1,
    });

    expect(result.totalCount).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.entries).toHaveLength(1);
  });

  it("throws DataAccessError when repository queries fail", async () => {
    const { client } = createRegisterMockClient({
      journalError: createBackendError("journal query failed"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getJournalRegister(TEST_ORGANIZATION_ID, {})).rejects.toMatchObject(
      {
        name: "DataAccessError",
        operation: "getJournalRegister.journals",
        message: "journal query failed",
      },
    );
  });

  it("does not use service-role access", async () => {
    const { client } = createRegisterMockClient({
      journals: [createJournalRow()],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getJournalRegister(TEST_ORGANIZATION_ID, {});

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
  });
});
