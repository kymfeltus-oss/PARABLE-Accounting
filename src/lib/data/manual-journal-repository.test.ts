import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createManualJournal } from "./manual-journal-repository";
import {
  createBackendError,
  createMockSupabaseClient,
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

const TEST_PERIOD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEST_DEBIT_ACCOUNT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEST_CREDIT_ACCOUNT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEST_FUND_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TEST_JOURNAL_ENTRY_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const validInput = {
  entryDate: "2026-07-15",
  description: "Manual adjustment",
  periodId: TEST_PERIOD_ID,
  lines: [
    {
      accountId: TEST_DEBIT_ACCOUNT_ID,
      description: "Debit line",
      debit: 100,
      credit: 0,
      fundId: TEST_FUND_ID,
    },
    {
      accountId: TEST_CREDIT_ACCOUNT_ID,
      description: null,
      debit: 0,
      credit: 100,
      fundId: null,
    },
  ],
};

function createJournalEntryRow() {
  return {
    id: TEST_JOURNAL_ENTRY_ID,
    organization_id: TEST_ORGANIZATION_ID,
    accounting_period_id: TEST_PERIOD_ID,
    entry_number: "MAN-EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE",
    entry_date: "2026-07-15",
    description: "Manual adjustment",
    source_type: "manual",
    status: "posted",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
  };
}

function createManualJournalRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createMockSupabaseClient({});
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

describe("createManualJournal", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(createManualJournal("", validInput)).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createManualJournalRpcMockClient({
      data: createJournalEntryRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createManualJournal(TEST_ORGANIZATION_ID, validInput);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the record_manual_journal RPC with exact argument names", async () => {
    const { client, rpcMock } = createManualJournalRpcMockClient({
      data: createJournalEntryRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createManualJournal(TEST_ORGANIZATION_ID, validInput);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("record_manual_journal", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_entry_date: "2026-07-15",
      input_description: "Manual adjustment",
      input_period_id: TEST_PERIOD_ID,
      input_lines: [
        {
          account_id: TEST_DEBIT_ACCOUNT_ID,
          description: "Debit line",
          debit: 100,
          credit: 0,
          fund_id: TEST_FUND_ID,
        },
        {
          account_id: TEST_CREDIT_ACCOUNT_ID,
          description: null,
          debit: 0,
          credit: 100,
          fund_id: null,
        },
      ],
    });
  });

  it("maps the RPC journal row to typed success data", async () => {
    const { client } = createManualJournalRpcMockClient({
      data: createJournalEntryRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await createManualJournal(TEST_ORGANIZATION_ID, validInput);

    expect(result).toEqual({
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
      entryNumber: "MAN-EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE",
    });
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createManualJournalRpcMockClient({
      data: null,
      error: createBackendError("Journal entry is not balanced"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createManualJournal(TEST_ORGANIZATION_ID, validInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("preserves the RPC error message in DataAccessError", async () => {
    const { client } = createManualJournalRpcMockClient({
      data: null,
      error: createBackendError("Accounting period is closed"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createManualJournal(TEST_ORGANIZATION_ID, validInput),
    ).rejects.toMatchObject({
      message: "Accounting period is closed",
    });
  });

  it("does not perform direct table inserts or id-only lookups", async () => {
    const { client, fromMock } = createManualJournalRpcMockClient({
      data: createJournalEntryRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createManualJournal(TEST_ORGANIZATION_ID, validInput);

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws DataAccessError when the RPC returns no row", async () => {
    const { client } = createManualJournalRpcMockClient({
      data: null,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createManualJournal(TEST_ORGANIZATION_ID, validInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
