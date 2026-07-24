import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const ACTIONS_PATH = path.join(
  process.cwd(),
  "src/app/(workspace)/giving/actions.ts",
);

const TEST_GIVING_TRANSACTION_ID = "55555555-5555-4555-8555-555555555555";
const TEST_DEBIT_ACCOUNT_ID = "77777777-7777-4777-8777-777777777771";
const TEST_CREDIT_ACCOUNT_ID = "99999999-9999-4999-8999-999999999999";
const TEST_JOURNAL_ENTRY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const recordedGiving = {
  id: TEST_GIVING_TRANSACTION_ID,
  organization_id: TEST_ORGANIZATION_ID,
  member_id: null,
  fund_id: null,
  transaction_date: "2026-07-20",
  amount: 250,
  giving_method: "cash",
  reference: "GIV-2001",
  status: "recorded",
  journal_entry_id: TEST_JOURNAL_ENTRY_ID,
  created_at: "2026-07-20T12:00:00.000Z",
  updated_at: "2026-07-20T12:00:00.000Z",
};

const validRecordInput = {
  givingTransactionId: TEST_GIVING_TRANSACTION_ID,
  debitAccountId: TEST_DEBIT_ACCOUNT_ID,
  creditAccountId: TEST_CREDIT_ACCOUNT_ID,
};

const GENERIC_RECORD_GIVING_ERROR =
  "The giving transaction could not be recorded. Please try again.";

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  recordGivingMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  recordGivingMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/giving-repository", () => ({
  recordGiving: recordGivingMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { recordGivingAction } from "./actions";

describe("recordGivingAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    recordGivingMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    recordGivingMock.mockResolvedValue(recordedGiving);
  });

  it("rejects invalid giving transaction UUID", async () => {
    const result = await recordGivingAction({
      ...validRecordInput,
      givingTransactionId: "not-a-uuid",
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        givingTransactionId: "Enter a valid giving transaction identifier.",
      },
      message: GENERIC_RECORD_GIVING_ERROR,
    });
    expect(recordGivingMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects invalid debit account UUID", async () => {
    const result = await recordGivingAction({
      ...validRecordInput,
      debitAccountId: "bad-id",
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        debitAccountId: "Enter a valid debit account.",
      },
      message: GENERIC_RECORD_GIVING_ERROR,
    });
    expect(recordGivingMock).not.toHaveBeenCalled();
  });

  it("rejects invalid credit account UUID", async () => {
    const result = await recordGivingAction({
      ...validRecordInput,
      creditAccountId: "bad-id",
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        creditAccountId: "Enter a valid revenue account.",
      },
      message: GENERIC_RECORD_GIVING_ERROR,
    });
    expect(recordGivingMock).not.toHaveBeenCalled();
  });

  it("resolves organization server-side", async () => {
    await recordGivingAction(validRecordInput);

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("givingTransactionId: string");
    expect(contents).toContain("debitAccountId: string");
    expect(contents).toContain("creditAccountId: string");
    expect(contents).not.toMatch(
      /RecordGivingActionInput[\s\S]*organizationId:\s*string/,
    );
    expect(contents).toContain("getCurrentOrganizationId()");
  });

  it("calls repository with resolved organization id", async () => {
    await recordGivingAction(validRecordInput);

    expect(recordGivingMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      TEST_GIVING_TRANSACTION_ID,
      TEST_DEBIT_ACCOUNT_ID,
      TEST_CREDIT_ACCOUNT_ID,
    );
  });

  it("maps duplicate-recording error", async () => {
    recordGivingMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordGiving",
        message: "Giving transaction is already linked to a journal entry",
      }),
    );

    const result = await recordGivingAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message:
        "This giving transaction has already been recorded to the ledger.",
    });
  });

  it("maps insufficient-role error", async () => {
    recordGivingMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordGiving",
        message: "Insufficient role to record giving",
      }),
    );

    const result = await recordGivingAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: "You do not have permission to record this giving transaction.",
    });
  });

  it("maps closed-period error", async () => {
    recordGivingMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordGiving",
        message: "Accounting period is closed",
      }),
    );

    const result = await recordGivingAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message:
        "This giving transaction cannot be recorded because its accounting period is closed.",
    });
  });

  it("maps expired-session error", async () => {
    recordGivingMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordGiving",
        message: "Authenticated user is required",
      }),
    );

    const result = await recordGivingAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: "Your session has expired. Please sign in again.",
    });
  });

  it("maps unknown error safely", async () => {
    recordGivingMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordGiving",
        message: "Journal entry is not balanced",
      }),
    );

    const result = await recordGivingAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: GENERIC_RECORD_GIVING_ERROR,
    });
    if (!result.success) {
      expect(result.message).not.toContain("Journal entry");
    }
  });

  it("revalidates /giving on success", async () => {
    await recordGivingAction(validRecordInput);

    expect(revalidatePathMock).toHaveBeenCalledWith("/giving");
  });

  it("revalidates /giving/[id] on success", async () => {
    await recordGivingAction(validRecordInput);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/giving/${TEST_GIVING_TRANSACTION_ID}`,
    );
  });

  it("returns success result with recorded status", async () => {
    const result = await recordGivingAction(validRecordInput);

    expect(result).toEqual({
      success: true,
      givingTransactionId: TEST_GIVING_TRANSACTION_ID,
      status: "recorded",
      journalEntryId: TEST_JOURNAL_ENTRY_ID,
    });
  });

  it("does not redirect", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).not.toContain("redirect(");
    expect(contents).not.toMatch(/from "next\/navigation"/);
  });
});
