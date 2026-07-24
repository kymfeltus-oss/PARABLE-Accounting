import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  getJournalVoidEligibility,
  voidJournalEntry,
} from "./journal-void-repository";
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

const JOURNAL_ENTRY_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function createVoidedJournalRow() {
  return {
    id: JOURNAL_ENTRY_ID,
    organization_id: TEST_ORGANIZATION_ID,
    accounting_period_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    entry_number: "MAN-TEST",
    entry_date: "2026-07-15",
    description: "Manual entry",
    source_type: "manual",
    status: "void",
    void_reason: "Duplicate entry",
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
  };
}

describe("voidJournalEntry", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      voidJournalEntry("", {
        journalEntryId: JOURNAL_ENTRY_ID,
        reason: "Duplicate entry",
      }),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls void_journal_entry RPC with exact argument names", async () => {
    const { client: tableClient } = createMockSupabaseClient({});
    const rpcMock = vi.fn().mockResolvedValue({
      data: createVoidedJournalRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue({
      ...tableClient,
      rpc: rpcMock,
    });

    const result = await voidJournalEntry(TEST_ORGANIZATION_ID, {
      journalEntryId: JOURNAL_ENTRY_ID,
      reason: "Duplicate entry",
    });

    expect(rpcMock).toHaveBeenCalledWith("void_journal_entry", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_journal_entry_id: JOURNAL_ENTRY_ID,
      input_reason: "Duplicate entry",
    });
    expect(result).toEqual({
      journalEntryId: JOURNAL_ENTRY_ID,
      entryNumber: "MAN-TEST",
    });
  });

  it("maps RPC failures to DataAccessError", async () => {
    const { client: tableClient } = createMockSupabaseClient({});
    createServerSupabaseClientMock.mockResolvedValue({
      ...tableClient,
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: createBackendError("Only posted journal entries can be voided"),
      }),
    });

    await expect(
      voidJournalEntry(TEST_ORGANIZATION_ID, {
        journalEntryId: JOURNAL_ENTRY_ID,
        reason: "Duplicate entry",
      }),
    ).rejects.toMatchObject({
      message: "Only posted journal entries can be voided",
    });
  });
});

describe("getJournalVoidEligibility", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  function createEligibilityClient(options: {
    role?: string;
    journal?: Array<{
      id: string;
      organization_id: string;
      source_type: string;
      status: string;
      reverses_journal_entry_id: string | null;
    }>;
    existingReversal?: Array<{ id: string }>;
  }) {
    const { client } = createMockSupabaseClient({
      organization_memberships: [
        {
          data: [{ role: options.role ?? "owner" }],
          error: null,
        },
      ],
      journal_entries: [
        {
          data: options.journal ?? [
            {
              id: JOURNAL_ENTRY_ID,
              organization_id: TEST_ORGANIZATION_ID,
              source_type: "manual",
              status: "posted",
              reverses_journal_entry_id: null,
            },
          ],
          error: null,
        },
        {
          data: options.existingReversal ?? [],
          error: null,
        },
      ],
    });

    return {
      ...client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
    };
  }

  it("allows void when posted manual journal has no reversal child", async () => {
    createServerSupabaseClientMock.mockResolvedValue(createEligibilityClient({}));

    await expect(
      getJournalVoidEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toEqual({
      canVoid: true,
      reason: null,
    });
  });

  it("rejects when journal is already void", async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createEligibilityClient({
        journal: [
          {
            id: JOURNAL_ENTRY_ID,
            organization_id: TEST_ORGANIZATION_ID,
            source_type: "manual",
            status: "void",
            reverses_journal_entry_id: null,
          },
        ],
      }),
    );

    await expect(
      getJournalVoidEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toEqual({
      canVoid: false,
      reason: "This journal entry has already been voided.",
    });
  });

  it("rejects when a reversal child exists", async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createEligibilityClient({
        existingReversal: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }],
      }),
    );

    await expect(
      getJournalVoidEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toEqual({
      canVoid: false,
      reason: "This journal entry has already been reversed.",
    });
  });
});
