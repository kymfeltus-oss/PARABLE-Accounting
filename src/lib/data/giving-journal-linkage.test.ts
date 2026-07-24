import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getGivingJournalLinkage } from "./giving-journal-linkage";
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
const TEST_GIVING_TRANSACTION_ID = "66666666-6666-4666-8666-666666666666";
const TEST_JOURNAL_ENTRY_ID = "77777777-7777-4777-8777-777777777777";
const TEST_PERIOD_ID = "88888888-8888-4888-8888-888888888888";

function createRecordedGivingRow(
  overrides: Partial<{
    status: string;
    journal_entry_id: string | null;
    reference: string | null;
    organization_id: string;
  }> = {},
) {
  return {
    id: TEST_GIVING_TRANSACTION_ID,
    organization_id: TEST_ORGANIZATION_ID,
    status: "recorded",
    journal_entry_id: TEST_JOURNAL_ENTRY_ID,
    reference: "CHK-1001",
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
    entry_number: "GIV-66666666666646668666666666666666",
    entry_date: "2026-07-10",
    status: "posted",
    ...overrides,
  };
}

function createLinkageMockClient(options: {
  giving?: unknown;
  journal?: unknown;
  period?: unknown;
  lines?: unknown;
  givingError?: ReturnType<typeof createBackendError> | null;
}) {
  return createMockSupabaseClient({
    giving_transactions: [
      {
        data: options.givingError ? null : (options.giving ?? []),
        error: options.givingError ?? null,
      },
    ],
    journal_entries: [{ data: options.journal ?? [], error: null }],
    accounting_periods: [{ data: options.period ?? [], error: null }],
    journal_entry_lines: [{ data: options.lines ?? [], error: null }],
  });
}

describe("getGivingJournalLinkage", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("applies organization scope to the giving transaction lookup", async () => {
    const { client, queryLog } = createLinkageMockClient({
      giving: [createRecordedGivingRow()],
      journal: [createJournalRow()],
      period: [{ name: "July 2026" }],
      lines: [],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getGivingJournalLinkage(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_TRANSACTION_ID,
    );

    const givingQuery = queryLog.find(
      (query) => query.table === "giving_transactions",
    );
    expect(givingQuery).toBeDefined();
    expect(hasOrganizationFilter(givingQuery!, TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("maps a recorded giving transaction with journal linkage correctly", async () => {
    const { client } = createLinkageMockClient({
      giving: [createRecordedGivingRow({ reference: "CHK-1001" })],
      journal: [createJournalRow()],
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
      getGivingJournalLinkage(
        TEST_ORGANIZATION_ID,
        TEST_GIVING_TRANSACTION_ID,
      ),
    ).resolves.toEqual({
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
      entryNumber: "GIV-66666666666646668666666666666666",
      entryDate: "2026-07-10",
      status: "posted",
      totalDebit: 75.25,
      totalCredit: 75.25,
      periodName: "July 2026",
      sourceReference: "CHK-1001",
    });
  });

  it("returns null when journal_entry_id is null", async () => {
    const { client, queryLog } = createLinkageMockClient({
      giving: [createRecordedGivingRow({ journal_entry_id: null })],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getGivingJournalLinkage(
        TEST_ORGANIZATION_ID,
        TEST_GIVING_TRANSACTION_ID,
      ),
    ).resolves.toBeNull();

    expect(
      queryLog.some((query) => query.table === "journal_entries"),
    ).toBe(false);
  });

  it("does not expose cross-organization journal entries", async () => {
    const { client } = createLinkageMockClient({
      giving: [createRecordedGivingRow()],
      journal: [
        createJournalRow({
          organization_id: OTHER_ORGANIZATION_ID,
        }),
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getGivingJournalLinkage(
        TEST_ORGANIZATION_ID,
        TEST_GIVING_TRANSACTION_ID,
      ),
    ).resolves.toBeNull();
  });

  it("throws DataAccessError when repository queries fail", async () => {
    const { client } = createLinkageMockClient({
      givingError: createBackendError("giving lookup failed"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getGivingJournalLinkage(
        TEST_ORGANIZATION_ID,
        TEST_GIVING_TRANSACTION_ID,
      ),
    ).rejects.toMatchObject({
      name: "DataAccessError",
      operation: "getGivingJournalLinkage.givingTransaction",
    });
  });

  it("throws DataAccessError for invalid givingTransactionId", async () => {
    await expect(
      getGivingJournalLinkage(TEST_ORGANIZATION_ID, "   "),
    ).rejects.toMatchObject({
      name: "DataAccessError",
      operation: "getGivingJournalLinkage",
    });
  });
});
