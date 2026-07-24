import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  createGivingTransactionMock,
  recordGivingMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  createGivingTransactionMock: vi.fn(),
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
  createGivingTransaction: createGivingTransactionMock,
  recordGiving: recordGivingMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createGivingTransactionAction,
  recordGivingAction,
} from "./actions";

const validInput = {
  transactionDate: "2026-07-01",
  amount: 100,
  givingMethod: "cash" as const,
};

describe("createGivingTransactionAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createGivingTransactionMock.mockReset();
    recordGivingMock.mockReset();
    revalidatePathMock.mockReset();

    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    createGivingTransactionMock.mockResolvedValue({
      id: "gift-1",
      status: "recorded",
    });
  });

  it("creates giving without recording when accounts are omitted", async () => {
    const result = await createGivingTransactionAction(validInput);

    expect(result).toEqual({
      success: true,
      givingTransactionId: "gift-1",
      journalEntryId: null,
    });
    expect(createGivingTransactionMock).toHaveBeenCalledTimes(1);
    expect(recordGivingMock).not.toHaveBeenCalled();
  });

  it("records immediately when both accounts are provided", async () => {
    recordGivingMock.mockResolvedValue({
      id: "gift-1",
      journal_entry_id: "journal-1",
    });

    const result = await createGivingTransactionAction({
      ...validInput,
      debitAccountId: "11111111-1111-4111-8111-111111111111",
      creditAccountId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result).toEqual({
      success: true,
      givingTransactionId: "gift-1",
      journalEntryId: "journal-1",
    });
    expect(recordGivingMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      "gift-1",
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );
  });
});

describe("recordGivingAction remains intact", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    recordGivingMock.mockReset();

    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    recordGivingMock.mockResolvedValue({
      id: "gift-1",
      journal_entry_id: "journal-1",
    });
  });

  it("still records giving through recordGiving", async () => {
    const result = await recordGivingAction({
      givingTransactionId: "11111111-1111-4111-8111-111111111111",
      debitAccountId: "22222222-2222-4222-8222-222222222222",
      creditAccountId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.success).toBe(true);
    expect(recordGivingMock).toHaveBeenCalledTimes(1);
  });
});
