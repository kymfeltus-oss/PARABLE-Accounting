import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const TEST_BANK_ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const TEST_CHART_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const TEST_BANK_TRANSACTION_ID = "33333333-3333-4333-8333-333333333333";
const TEST_MATCHED_SOURCE_ID = "44444444-4444-4444-8444-444444444444";

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  createBankAccountMock,
  createBankTransactionMock,
  matchBankTransactionMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  createBankAccountMock: vi.fn(),
  createBankTransactionMock: vi.fn(),
  matchBankTransactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/banking-repository", () => ({
  createBankAccount: createBankAccountMock,
  createBankTransaction: createBankTransactionMock,
  matchBankTransaction: matchBankTransactionMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createBankAccountAction,
  createBankTransactionAction,
  matchBankTransactionAction,
} from "./actions";

function createFormData(entries: Record<string, string>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
}

describe("banking actions", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createBankAccountMock.mockReset();
    createBankTransactionMock.mockReset();
    matchBankTransactionMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
  });

  it("createBankAccountAction requires authentication", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await createBankAccountAction(
      createFormData({
        name: "Savings",
        accountId: TEST_CHART_ACCOUNT_ID,
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in to create bank accounts.",
    });
  });

  it("createBankAccountAction creates a bank account", async () => {
    createBankAccountMock.mockResolvedValue({
      id: TEST_BANK_ACCOUNT_ID,
      name: "Savings",
    });

    const result = await createBankAccountAction(
      createFormData({
        name: "Savings",
        accountId: TEST_CHART_ACCOUNT_ID,
      }),
    );

    expect(result.ok).toBe(true);
    expect(createBankAccountMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
      name: "Savings",
      accountId: TEST_CHART_ACCOUNT_ID,
      institutionName: null,
      accountType: null,
      lastFour: null,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/banking");
  });

  it("createBankTransactionAction validates amount", async () => {
    const result = await createBankTransactionAction(
      createFormData({
        bankAccountId: TEST_BANK_ACCOUNT_ID,
        transactionDate: "2026-07-24",
        amount: "0",
        transactionType: "inbound",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Enter a nonzero amount.",
    });
  });

  it("createBankTransactionAction creates a transaction", async () => {
    createBankTransactionMock.mockResolvedValue({
      id: TEST_BANK_TRANSACTION_ID,
    });

    const result = await createBankTransactionAction(
      createFormData({
        bankAccountId: TEST_BANK_ACCOUNT_ID,
        transactionDate: "2026-07-24",
        amount: "125.50",
        description: "Deposit",
        transactionType: "inbound",
      }),
    );

    expect(result.ok).toBe(true);
    expect(createBankTransactionMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      {
        bankAccountId: TEST_BANK_ACCOUNT_ID,
        transactionDate: "2026-07-24",
        amount: 125.5,
        description: "Deposit",
        transactionType: "inbound",
      },
    );
  });

  it("matchBankTransactionAction maps RPC errors", async () => {
    matchBankTransactionMock.mockRejectedValue(
      new DataAccessError({
        operation: "matchBankTransaction",
        message: "Bank transaction is already matched",
      }),
    );

    const result = await matchBankTransactionAction(
      createFormData({
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        matchType: "expense",
        matchedSourceId: TEST_MATCHED_SOURCE_ID,
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "This bank transaction has already been matched.",
    });
  });

  it("matchBankTransactionAction confirms a match", async () => {
    matchBankTransactionMock.mockResolvedValue({
      bankTransactionId: TEST_BANK_TRANSACTION_ID,
      matchId: "match-1",
    });

    const result = await matchBankTransactionAction(
      createFormData({
        bankTransactionId: TEST_BANK_TRANSACTION_ID,
        matchType: "expense",
        matchedSourceId: TEST_MATCHED_SOURCE_ID,
      }),
    );

    expect(result).toEqual({
      ok: true,
      bankTransactionId: TEST_BANK_TRANSACTION_ID,
      matchId: "match-1",
    });
  });
});
