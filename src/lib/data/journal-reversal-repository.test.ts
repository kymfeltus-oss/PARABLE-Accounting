import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  getJournalReversalEligibility,
  reverseJournalEntry,
} from "./journal-reversal-repository";
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
const PERIOD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function createReversalJournalRow() {
  return {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    organization_id: TEST_ORGANIZATION_ID,
    accounting_period_id: PERIOD_ID,
    entry_number: "REV-TEST",
    entry_date: "2026-07-20",
    description: "Reversal of MAN-TEST",
    source_type: "reversal",
    status: "posted",
    reverses_journal_entry_id: JOURNAL_ENTRY_ID,
    reversal_reason: "Corrected allocation",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
  };
}

describe("reverseJournalEntry", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      reverseJournalEntry("", {
        journalEntryId: JOURNAL_ENTRY_ID,
        reversalDate: "2026-07-20",
        periodId: PERIOD_ID,
        reason: "Corrected allocation",
      }),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls reverse_journal_entry RPC with exact argument names", async () => {
    const { client: tableClient } = createMockSupabaseClient({});
    const rpcMock = vi.fn().mockResolvedValue({
      data: createReversalJournalRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue({
      ...tableClient,
      rpc: rpcMock,
    });

    const result = await reverseJournalEntry(TEST_ORGANIZATION_ID, {
      journalEntryId: JOURNAL_ENTRY_ID,
      reversalDate: "2026-07-20",
      periodId: PERIOD_ID,
      reason: "Corrected allocation",
    });

    expect(rpcMock).toHaveBeenCalledWith("reverse_journal_entry", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_journal_entry_id: JOURNAL_ENTRY_ID,
      input_reversal_date: "2026-07-20",
      input_period_id: PERIOD_ID,
      input_reason: "Corrected allocation",
    });
    expect(result).toEqual({
      journalEntryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      entryNumber: "REV-TEST",
    });
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("maps RPC failures to DataAccessError", async () => {
    const { client: tableClient } = createMockSupabaseClient({});
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: createBackendError("Journal entry has already been reversed"),
    });
    createServerSupabaseClientMock.mockResolvedValue({
      ...tableClient,
      rpc: rpcMock,
    });

    await expect(
      reverseJournalEntry(TEST_ORGANIZATION_ID, {
        journalEntryId: JOURNAL_ENTRY_ID,
        reversalDate: "2026-07-20",
        periodId: PERIOD_ID,
        reason: "Corrected allocation",
      }),
    ).rejects.toMatchObject({
      name: "DataAccessError",
      message: "Journal entry has already been reversed",
    });
  });
});

describe("getJournalReversalEligibility", () => {
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
    periods?: Array<{
      id: string;
      name: string;
      start_date: string;
      end_date: string;
      status: string;
      organization_id: string;
      created_at: string;
      updated_at: string;
    }>;
  }) {
    const { client } = createMockSupabaseClient({
      accounting_periods: [
        {
          data: options.periods ?? [
            {
              id: PERIOD_ID,
              name: "July 2026",
              start_date: "2026-07-01",
              end_date: "2026-07-31",
              status: "open",
              organization_id: TEST_ORGANIZATION_ID,
              created_at: "2026-07-01T00:00:00.000Z",
              updated_at: "2026-07-01T00:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
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

  it("allows an owner to reverse an eligible posted manual journal", async () => {
    createServerSupabaseClientMock.mockResolvedValue(createEligibilityClient({}));

    await expect(
      getJournalReversalEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toMatchObject({
      canReverse: true,
      reason: null,
    });
  });

  it("rejects viewers", async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createEligibilityClient({ role: "viewer" }),
    );

    await expect(
      getJournalReversalEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toMatchObject({
      canReverse: false,
      reason: "You do not have permission to reverse journal entries.",
    });
  });

  it("rejects already-reversed journals", async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createEligibilityClient({
        journal: [
          {
            id: JOURNAL_ENTRY_ID,
            organization_id: TEST_ORGANIZATION_ID,
            source_type: "manual",
            status: "reversed",
            reverses_journal_entry_id: null,
          },
        ],
      }),
    );

    await expect(
      getJournalReversalEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toMatchObject({
      canReverse: false,
      reason: "This journal entry has already been reversed.",
    });
  });

  it("rejects reversal journals", async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createEligibilityClient({
        journal: [
          {
            id: JOURNAL_ENTRY_ID,
            organization_id: TEST_ORGANIZATION_ID,
            source_type: "reversal",
            status: "posted",
            reverses_journal_entry_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        ],
      }),
    );

    await expect(
      getJournalReversalEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toMatchObject({
      canReverse: false,
      reason: "Reversal journals cannot be reversed.",
    });
  });

  it("rejects ineligible source types", async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      createEligibilityClient({
        journal: [
          {
            id: JOURNAL_ENTRY_ID,
            organization_id: TEST_ORGANIZATION_ID,
            source_type: "expense",
            status: "posted",
            reverses_journal_entry_id: null,
          },
        ],
      }),
    );

    await expect(
      getJournalReversalEligibility(TEST_ORGANIZATION_ID, JOURNAL_ENTRY_ID),
    ).resolves.toMatchObject({
      canReverse: false,
      reason: "This journal source type cannot be reversed.",
    });
  });
});
