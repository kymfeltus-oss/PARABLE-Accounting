import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const TEST_PERIOD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEST_DEBIT_ACCOUNT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEST_CREDIT_ACCOUNT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEST_FUND_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TEST_JOURNAL_ENTRY_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  createManualJournalMock,
  reverseJournalEntryMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  createManualJournalMock: vi.fn(),
  reverseJournalEntryMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/manual-journal-repository", () => ({
  createManualJournal: createManualJournalMock,
}));

vi.mock("@/lib/data/journal-reversal-repository", () => ({
  reverseJournalEntry: reverseJournalEntryMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createManualJournalAction,
  reverseJournalEntryAction,
} from "./actions";

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

const GENERIC_CREATE_MANUAL_JOURNAL_ERROR =
  "The manual journal entry could not be recorded. Please try again.";

describe("createManualJournalAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createManualJournalMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    createManualJournalMock.mockResolvedValue({
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
      entryNumber: "MAN-TEST",
    });
  });

  it("requires authentication", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await createManualJournalAction(validInput);

    expect(result).toEqual({
      success: false,
      message: "You must be signed in to record manual journal entries.",
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects unknown top-level keys", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      organizationId: TEST_ORGANIZATION_ID,
    } as typeof validInput & { organizationId: string });

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects invalid entry dates", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      entryDate: "2026-13-40",
    });

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects invalid period UUIDs", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      periodId: "bad-id",
    });

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects fewer than two lines", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [validInput.lines[0]],
    });

    expect(result).toEqual({
      success: false,
      message: "At least two journal lines are required.",
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("validates account UUIDs", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          accountId: "not-a-uuid",
        },
        validInput.lines[1],
      ],
    });

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("validates optional fund UUIDs", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          fundId: "bad-id",
        },
        validInput.lines[1],
      ],
    });

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects negative values", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: -1,
        },
        validInput.lines[1],
      ],
    });

    expect(result).toEqual({
      success: false,
      message: "Debit and credit amounts must be zero or greater.",
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects both debit and credit on one line", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: 50,
          credit: 50,
        },
        validInput.lines[1],
      ],
    });

    expect(result).toEqual({
      success: false,
      message: "Each line cannot have both a debit and a credit amount.",
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects empty lines", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: 0,
          credit: 0,
        },
        validInput.lines[1],
      ],
    });

    expect(result).toEqual({
      success: false,
      message: "Each line must include a positive debit or credit amount.",
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects unbalanced journals before calling the repository", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: 100,
          credit: 0,
        },
        {
          ...validInput.lines[1],
          debit: 0,
          credit: 90,
        },
      ],
    });

    expect(result).toEqual({
      success: false,
      message: "Total debits must equal total credits.",
    });
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("rejects zero-value journals before calling the repository", async () => {
    const result = await createManualJournalAction({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          debit: 0,
          credit: 0,
        },
        {
          ...validInput.lines[1],
          debit: 0,
          credit: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(createManualJournalMock).not.toHaveBeenCalled();
  });

  it("resolves organization server-side and passes normalized repository payload", async () => {
    await createManualJournalAction(validInput);

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(createManualJournalMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
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
    });
  });

  it("returns success result with journal identifiers", async () => {
    const result = await createManualJournalAction(validInput);

    expect(result).toEqual({
      success: true,
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
      entryNumber: "MAN-TEST",
    });
  });

  it("revalidates journal register, detail, and dashboard paths on success", async () => {
    await createManualJournalAction(validInput);

    expect(revalidatePathMock).toHaveBeenCalledWith("/accounting/journals");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/accounting/journals/${TEST_JOURNAL_ENTRY_ID}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("maps known RPC errors safely", async () => {
    createManualJournalMock.mockRejectedValue(
      new DataAccessError({
        operation: "createManualJournal",
        message: "Insufficient role to record manual journal",
      }),
    );

    const result = await createManualJournalAction(validInput);

    expect(result).toEqual({
      success: false,
      message: "You do not have permission to record manual journal entries.",
    });
  });

  it("maps closed period RPC errors safely", async () => {
    createManualJournalMock.mockRejectedValue(
      new DataAccessError({
        operation: "createManualJournal",
        message: "Accounting period is closed",
      }),
    );

    const result = await createManualJournalAction(validInput);

    expect(result).toEqual({
      success: false,
      message: "The selected accounting period is closed.",
    });
  });

  it("maps unknown RPC errors generically", async () => {
    createManualJournalMock.mockRejectedValue(
      new DataAccessError({
        operation: "createManualJournal",
        message: "unexpected database failure",
      }),
    );

    const result = await createManualJournalAction(validInput);

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
  });

  it("returns a generic error for unexpected failures", async () => {
    createManualJournalMock.mockRejectedValue(new Error("boom"));

    const result = await createManualJournalAction(validInput);

    expect(result).toEqual({
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

const REVERSAL_JOURNAL_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const validReverseInput = {
  journalEntryId: TEST_JOURNAL_ENTRY_ID,
  reversalDate: "2026-07-20",
  periodId: TEST_PERIOD_ID,
  reason: "Corrected allocation",
};

const GENERIC_REVERSE_JOURNAL_ERROR =
  "The journal entry could not be reversed. Please try again.";

describe("reverseJournalEntryAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    reverseJournalEntryMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    reverseJournalEntryMock.mockResolvedValue({
      journalEntryId: REVERSAL_JOURNAL_ID,
      entryNumber: "REV-TEST",
    });
  });

  it("requires authentication", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await reverseJournalEntryAction(validReverseInput);

    expect(result).toEqual({
      success: false,
      message: "You must be signed in to reverse journal entries.",
    });
    expect(reverseJournalEntryMock).not.toHaveBeenCalled();
  });

  it("invokes the repository with normalized inputs", async () => {
    const result = await reverseJournalEntryAction({
      ...validReverseInput,
      reason: "  Corrected allocation  ",
    });

    expect(reverseJournalEntryMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
      reversalDate: "2026-07-20",
      periodId: TEST_PERIOD_ID,
      reason: "Corrected allocation",
    });
    expect(result).toEqual({
      success: true,
      journalEntryId: REVERSAL_JOURNAL_ID,
      entryNumber: "REV-TEST",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/accounting/journals");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/accounting/journals/${TEST_JOURNAL_ENTRY_ID}`,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/accounting/journals/${REVERSAL_JOURNAL_ID}`,
    );
  });

  it("rejects a blank reason", async () => {
    const result = await reverseJournalEntryAction({
      ...validReverseInput,
      reason: "   ",
    });

    expect(result).toEqual({
      success: false,
      message: "A reversal reason is required.",
    });
    expect(reverseJournalEntryMock).not.toHaveBeenCalled();
  });

  it("maps already-reversed errors safely", async () => {
    reverseJournalEntryMock.mockRejectedValue(
      new DataAccessError({
        operation: "reverseJournalEntry",
        message: "Journal entry has already been reversed",
      }),
    );

    const result = await reverseJournalEntryAction(validReverseInput);

    expect(result).toEqual({
      success: false,
      message: "This journal entry has already been reversed.",
    });
  });

  it("maps unknown RPC errors generically", async () => {
    reverseJournalEntryMock.mockRejectedValue(
      new DataAccessError({
        operation: "reverseJournalEntry",
        message: "relation journal_entries does not exist",
      }),
    );

    const result = await reverseJournalEntryAction(validReverseInput);

    expect(result).toEqual({
      success: false,
      message: GENERIC_REVERSE_JOURNAL_ERROR,
    });
  });
});
