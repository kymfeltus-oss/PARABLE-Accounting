import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const ACTIONS_PATH = path.join(
  process.cwd(),
  "src/app/(workspace)/expenses/actions.ts",
);

const TEST_EXPENSE_ID = "55555555-5555-4555-8555-555555555555";
const TEST_VENDOR_ID = "44444444-4444-4444-8444-444444444444";

const TEST_ACCOUNT_ID_1 = "77777777-7777-4777-8777-777777777771";
const TEST_ACCOUNT_ID_2 = "77777777-7777-4777-8777-777777777772";
const TEST_FUND_ID = "88888888-8888-4888-8888-888888888888";
const TEST_CREDIT_ACCOUNT_ID = "99999999-9999-4999-8999-999999999999";
const TEST_JOURNAL_ENTRY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const createdExpense = {
  id: TEST_EXPENSE_ID,
  organization_id: TEST_ORGANIZATION_ID,
  vendor_id: TEST_VENDOR_ID,
  expense_date: "2026-07-20",
  description: "Office supplies",
  total_amount: 125.75,
  reference: "EXP-2001",
  payment_source: "card",
  status: "draft",
  created_at: "2026-07-20T12:00:00.000Z",
  updated_at: "2026-07-20T12:00:00.000Z",
};

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  createExpenseDraftMock,
  replaceExpenseDraftLinesMock,
  getExpenseDraftLinesMock,
  recordExpenseMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  createExpenseDraftMock: vi.fn(),
  replaceExpenseDraftLinesMock: vi.fn(),
  getExpenseDraftLinesMock: vi.fn(),
  recordExpenseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/expenses-repository", () => ({
  createExpenseDraft: createExpenseDraftMock,
  replaceExpenseDraftLines: replaceExpenseDraftLinesMock,
  getExpenseDraftLines: getExpenseDraftLinesMock,
  recordExpense: recordExpenseMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createExpenseDraftAction,
  getExpenseDraftLinesAction,
  recordExpenseAction,
  replaceExpenseDraftLinesAction,
} from "./actions";

const validInput = {
  expenseDate: "2026-07-20",
  description: "Office supplies",
  totalAmount: 125.75,
  vendorId: TEST_VENDOR_ID,
  reference: "EXP-2001",
  paymentSource: "card" as const,
};

describe("createExpenseDraftAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createExpenseDraftMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    createExpenseDraftMock.mockResolvedValue(createdExpense);
  });

  it('is a "use server" action module', () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents.startsWith('"use server";')).toBe(true);
  });

  it("calls getAuthenticatedUser()", async () => {
    await createExpenseDraftAction(validInput);

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("calls getCurrentOrganizationId()", async () => {
    await createExpenseDraftAction(validInput);

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("expenseDate: string");
    expect(contents).toContain("description: string");
    expect(contents).toContain("totalAmount: number");
    expect(contents).toContain("paymentSource:");
    expect(contents).not.toMatch(/organizationId:\s*string/);
    expect(contents).toContain("getCurrentOrganizationId()");
  });

  it("does not accept userId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).not.toMatch(/userId:\s*string/);
    expect(contents).not.toMatch(/user_id:\s*string/);
    expect(contents).toContain("getAuthenticatedUser()");
  });

  it("trims description before calling the repository", async () => {
    await createExpenseDraftAction({
      ...validInput,
      description: "  Office supplies  ",
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        description: "Office supplies",
      }),
    );
  });

  it("returns a safe failure for blank descriptions", async () => {
    const result = await createExpenseDraftAction({
      ...validInput,
      description: "   ",
    });

    expect(result).toEqual({
      success: false,
      message: "Expense description is required.",
    });
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for non-finite totals", async () => {
    const result = await createExpenseDraftAction({
      ...validInput,
      totalAmount: Number.NaN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(
        "Unable to create expense draft. Please verify the information and try again.",
      );
    }
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for zero totals", async () => {
    const result = await createExpenseDraftAction({
      ...validInput,
      totalAmount: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(
        "Unable to create expense draft. Please verify the information and try again.",
      );
    }
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for negative totals", async () => {
    const result = await createExpenseDraftAction({
      ...validInput,
      totalAmount: -10,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(
        "Unable to create expense draft. Please verify the information and try again.",
      );
    }
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
  });

  it.each([
    "bank",
    "card",
    "cash",
    "reimbursement",
    "other",
  ] as const)("accepts paymentSource %s", async (paymentSource) => {
    await createExpenseDraftAction({
      ...validInput,
      paymentSource,
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ paymentSource }),
    );
  });

  it("returns a safe failure for invalid payment sources", async () => {
    const result = await createExpenseDraftAction({
      ...validInput,
      paymentSource: "wire" as "card",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(
        "Unable to create expense draft. Please verify the information and try again.",
      );
    }
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
  });

  it("maps omitted vendorId to null", async () => {
    await createExpenseDraftAction({
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: 125.75,
      paymentSource: "card",
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ vendorId: null }),
    );
  });

  it("maps empty vendorId to null", async () => {
    await createExpenseDraftAction({
      ...validInput,
      vendorId: "   ",
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ vendorId: null }),
    );
  });

  it("forwards a provided vendorId", async () => {
    await createExpenseDraftAction(validInput);

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ vendorId: TEST_VENDOR_ID }),
    );
  });

  it("maps omitted reference to null", async () => {
    await createExpenseDraftAction({
      expenseDate: "2026-07-20",
      description: "Office supplies",
      totalAmount: 125.75,
      paymentSource: "card",
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ reference: null }),
    );
  });

  it("maps empty reference to null", async () => {
    await createExpenseDraftAction({
      ...validInput,
      reference: "",
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ reference: null }),
    );
  });

  it("trims a provided reference before calling the repository", async () => {
    await createExpenseDraftAction({
      ...validInput,
      reference: "  EXP-2001  ",
    });

    expect(createExpenseDraftMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ reference: "EXP-2001" }),
    );
  });

  it("passes the server-resolved organization ID to createExpenseDraft", async () => {
    await createExpenseDraftAction(validInput);

    expect(createExpenseDraftMock).toHaveBeenCalledTimes(1);
    expect(createExpenseDraftMock.mock.calls[0]?.[0]).toBe(TEST_ORGANIZATION_ID);
  });

  it("never sends status, actor_user_id, lines, or journal data to createExpenseDraft", async () => {
    await createExpenseDraftAction(validInput);

    const repositoryInput = createExpenseDraftMock.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(repositoryInput).not.toHaveProperty("status");
    expect(repositoryInput).not.toHaveProperty("actor_user_id");
    expect(repositoryInput).not.toHaveProperty("expenseLines");
    expect(repositoryInput).not.toHaveProperty("journalEntryId");
    expect(repositoryInput).not.toHaveProperty("journal_entries");
  });

  it("returns success with expenseId when the repository succeeds", async () => {
    const result = await createExpenseDraftAction(validInput);

    expect(result).toEqual({
      success: true,
      expenseId: TEST_EXPENSE_ID,
    });
  });

  it('calls revalidatePath("/expenses") on success', async () => {
    await createExpenseDraftAction(validInput);

    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
  });

  it("returns a safe failure for repository errors without exposing raw database details", async () => {
    createExpenseDraftMock.mockRejectedValue(
      new DataAccessError({
        operation: "createExpenseDraft",
        message: "Insufficient role to create draft expense",
      }),
    );

    const result = await createExpenseDraftAction(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(
        "Unable to create expense draft. Please verify the information and try again.",
      );
      expect(result.message).not.toContain("Insufficient role");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure when the user is unauthenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await createExpenseDraftAction(validInput);

    expect(result).toEqual({
      success: false,
      message: "You must be signed in to create expenses.",
    });
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure when organization context resolution fails", async () => {
    getCurrentOrganizationIdMock.mockRejectedValue(
      new DataAccessError({
        operation: "getCurrentOrganizationId.membership",
        message: "Authenticated user belongs to multiple organizations",
      }),
    );

    const result = await createExpenseDraftAction(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(
        "Unable to create expense draft. Please verify the information and try again.",
      );
      expect(result.message).not.toContain("multiple organizations");
    }
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a generic error for unexpected failures", async () => {
    createExpenseDraftMock.mockRejectedValue(new Error("boom"));

    const result = await createExpenseDraftAction(validInput);

    expect(result).toEqual({
      success: false,
      message:
        "Something went wrong while creating an expense draft. Please try again.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

const validReplaceInput = {
  expenseId: TEST_EXPENSE_ID,
  lines: [
    {
      accountId: TEST_ACCOUNT_ID_1,
      fundId: TEST_FUND_ID,
      amount: 85.5,
      description: "  Office supplies  ",
    },
    {
      accountId: TEST_ACCOUNT_ID_2,
      amount: 40.25,
    },
  ],
};

const updatedExpenseWithAllocation = {
  ...createdExpense,
  total_amount: 125.75,
};

const GENERIC_REPLACE_ERROR =
  "Unable to update expense allocation. Please verify the information and try again.";

describe("replaceExpenseDraftLinesAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createExpenseDraftMock.mockReset();
    replaceExpenseDraftLinesMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    replaceExpenseDraftLinesMock.mockResolvedValue(updatedExpenseWithAllocation);
  });

  it("calls getAuthenticatedUser()", async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("calls getCurrentOrganizationId()", async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("expenseId: string");
    expect(contents).toContain("lines:");
    expect(contents).not.toMatch(/ReplaceExpenseDraftLinesActionInput[\s\S]*organizationId:\s*string/);
    expect(contents).toContain("getCurrentOrganizationId()");
  });

  it("passes the server-resolved organization ID to replaceExpenseDraftLines", async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(replaceExpenseDraftLinesMock).toHaveBeenCalledTimes(1);
    expect(replaceExpenseDraftLinesMock.mock.calls[0]?.[0]).toBe(
      TEST_ORGANIZATION_ID,
    );
  });

  it("passes the validated expense ID to replaceExpenseDraftLines", async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(replaceExpenseDraftLinesMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        expenseId: TEST_EXPENSE_ID,
      }),
    );
  });

  it("preserves line order and maps line fields to the repository", async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(replaceExpenseDraftLinesMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      {
        expenseId: TEST_EXPENSE_ID,
        lines: [
          {
            accountId: TEST_ACCOUNT_ID_1,
            fundId: TEST_FUND_ID,
            amount: 85.5,
            description: "Office supplies",
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            fundId: null,
            amount: 40.25,
            description: null,
          },
        ],
      },
    );
  });

  it("maps empty fundId to null", async () => {
    await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, fundId: "   ", amount: 10 }],
    });

    expect(replaceExpenseDraftLinesMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            fundId: null,
          }),
        ],
      }),
    );
  });

  it("returns success with expenseId and authoritative totalAmount", async () => {
    const result = await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(result).toEqual({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      totalAmount: 125.75,
    });
  });

  it("parses string total_amount from the repository response", async () => {
    replaceExpenseDraftLinesMock.mockResolvedValue({
      ...updatedExpenseWithAllocation,
      total_amount: "240.50",
    });

    const result = await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(result).toEqual({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      totalAmount: 240.5,
    });
  });

  it('calls revalidatePath("/expenses") on success', async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
  });

  it("returns a safe failure for invalid expense UUIDs", async () => {
    const result = await replaceExpenseDraftLinesAction({
      ...validReplaceInput,
      expenseId: "not-a-uuid",
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for empty lines", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for more than 50 lines", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: Array.from({ length: 51 }, (_, index) => ({
        accountId: TEST_ACCOUNT_ID_1,
        amount: index + 1,
      })),
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for invalid account UUIDs", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: "bad-account", amount: 10 }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for invalid fund UUIDs", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, fundId: "bad-fund", amount: 10 }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for zero amounts", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, amount: 0 }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for negative amounts", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, amount: -5 }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for non-finite amounts", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, amount: Number.NaN }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for more than 2 decimal places", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, amount: 10.123 }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for oversized numeric amounts", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, amount: 10000000000000000 }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for blank descriptions", async () => {
    const result = await replaceExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      lines: [{ accountId: TEST_ACCOUNT_ID_1, amount: 10, description: "   " }],
    });

    expect(result).toEqual({ success: false, message: GENERIC_REPLACE_ERROR });
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure when the user is unauthenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(result).toEqual({
      success: false,
      message: "You must be signed in to update expense allocation.",
    });
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure when organization context resolution fails", async () => {
    getCurrentOrganizationIdMock.mockRejectedValue(
      new DataAccessError({
        operation: "getCurrentOrganizationId.membership",
        message: "Authenticated user belongs to multiple organizations",
      }),
    );

    const result = await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(GENERIC_REPLACE_ERROR);
      expect(result.message).not.toContain("multiple organizations");
    }
    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for repository errors without exposing raw database details", async () => {
    replaceExpenseDraftLinesMock.mockRejectedValue(
      new DataAccessError({
        operation: "replaceExpenseDraftLines",
        message: "Insufficient role to replace expense draft lines",
      }),
    );

    const result = await replaceExpenseDraftLinesAction(validReplaceInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(GENERIC_REPLACE_ERROR);
      expect(result.message).not.toContain("Insufficient role");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("never sends totalAmount, status, line numbers, or journal data to the repository", async () => {
    await replaceExpenseDraftLinesAction(validReplaceInput);

    const repositoryInput = replaceExpenseDraftLinesMock.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(repositoryInput).not.toHaveProperty("totalAmount");
    expect(repositoryInput).not.toHaveProperty("status");
    expect(repositoryInput).not.toHaveProperty("organizationId");

    for (const line of repositoryInput.lines as Array<Record<string, unknown>>) {
      expect(line).not.toHaveProperty("lineNumber");
      expect(line).not.toHaveProperty("id");
      expect(line).not.toHaveProperty("expenseId");
      expect(line).not.toHaveProperty("organizationId");
      expect(line).not.toHaveProperty("journalEntryId");
    }
  });

  it("does not use Supabase clients directly in the action module", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).not.toContain("createServerSupabaseClient");
    expect(contents).not.toContain("createAdminSupabaseClient");
    expect(contents).not.toContain('.from("expense_lines")');
    expect(contents).not.toContain("journal_entries");
    expect(contents).not.toContain("journal_entry_lines");
  });
});

const GENERIC_GET_LINES_ERROR =
  "Unable to load expense allocation. Please try again.";

const sampleExpenseDraftLines = [
  {
    id: "99999999-9999-4999-8999-999999999991",
    expenseId: TEST_EXPENSE_ID,
    accountId: TEST_ACCOUNT_ID_1,
    fundId: null,
    lineNumber: 1,
    description: "Office supplies",
    amount: 85.5,
  },
  {
    id: "99999999-9999-4999-8999-999999999992",
    expenseId: TEST_EXPENSE_ID,
    accountId: TEST_ACCOUNT_ID_2,
    fundId: TEST_FUND_ID,
    lineNumber: 2,
    description: null,
    amount: 40.25,
  },
];

describe("getExpenseDraftLinesAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    getExpenseDraftLinesMock.mockReset();
    revalidatePathMock.mockReset();
    createExpenseDraftMock.mockReset();
    replaceExpenseDraftLinesMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpenseDraftLinesMock.mockResolvedValue([]);
  });

  it("calls getAuthenticatedUser()", async () => {
    await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("calls getCurrentOrganizationId()", async () => {
    await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("expenseId: string");
    expect(contents).not.toMatch(
      /GetExpenseDraftLinesActionInput[\s\S]*organizationId:\s*string/,
    );
    expect(contents).toContain("getCurrentOrganizationId()");
  });

  it("returns a safe failure for invalid expense UUIDs", async () => {
    const result = await getExpenseDraftLinesAction({ expenseId: "not-a-uuid" });

    expect(result).toEqual({ success: false, message: GENERIC_GET_LINES_ERROR });
    expect(getExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for blank expense IDs", async () => {
    const result = await getExpenseDraftLinesAction({ expenseId: "   " });

    expect(result).toEqual({ success: false, message: GENERIC_GET_LINES_ERROR });
    expect(getExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a safe failure for unknown input properties", async () => {
    const result = await getExpenseDraftLinesAction({
      expenseId: TEST_EXPENSE_ID,
      organizationId: TEST_ORGANIZATION_ID,
    } as { expenseId: string });

    expect(result).toEqual({ success: false, message: GENERIC_GET_LINES_ERROR });
    expect(getExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("passes the server-resolved organization ID and trimmed expense ID to the repository", async () => {
    await getExpenseDraftLinesAction({ expenseId: `  ${TEST_EXPENSE_ID}  ` });

    expect(getExpenseDraftLinesMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
    );
  });

  it("returns success with an empty lines array", async () => {
    const result = await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(result).toEqual({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: [],
    });
  });

  it("returns populated lines unchanged and ordered", async () => {
    getExpenseDraftLinesMock.mockResolvedValue(sampleExpenseDraftLines);

    const result = await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(result).toEqual({
      success: true,
      expenseId: TEST_EXPENSE_ID,
      lines: sampleExpenseDraftLines,
    });
  });

  it("does not call revalidatePath", async () => {
    await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe sign-in message when unauthenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(result).toEqual({
      success: false,
      message: "You must be signed in to view expense allocation.",
    });
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(getExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a generic safe message when organization context resolution fails", async () => {
    getCurrentOrganizationIdMock.mockRejectedValue(
      new DataAccessError({
        operation: "getCurrentOrganizationId.membership",
        message: "Authenticated user belongs to multiple organizations",
      }),
    );

    const result = await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(GENERIC_GET_LINES_ERROR);
      expect(result.message).not.toContain("multiple organizations");
    }
    expect(getExpenseDraftLinesMock).not.toHaveBeenCalled();
  });

  it("returns a generic safe message for repository errors without exposing raw details", async () => {
    getExpenseDraftLinesMock.mockRejectedValue(
      new DataAccessError({
        operation: "getExpenseDraftLines",
        message: "Expense not found for organization",
      }),
    );

    const result = await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(GENERIC_GET_LINES_ERROR);
      expect(result.message).not.toContain("Expense not found");
    }
  });

  it("returns a safe fallback for unexpected errors", async () => {
    getExpenseDraftLinesMock.mockRejectedValue(new Error("boom"));

    const result = await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(result).toEqual({
      success: false,
      message: "Something went wrong while loading expense allocation. Please try again.",
    });
  });

  it("does not use Supabase clients directly or call mutation repositories", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).not.toContain("createServerSupabaseClient");
    expect(contents).not.toContain("createAdminSupabaseClient");
    expect(contents).toContain("getExpenseDraftLines(");
    expect(contents).not.toContain("journal_entries");
    expect(contents).not.toContain("journal_entry_lines");
  });

  it("does not call replaceExpenseDraftLines during read", async () => {
    await getExpenseDraftLinesAction({ expenseId: TEST_EXPENSE_ID });

    expect(replaceExpenseDraftLinesMock).not.toHaveBeenCalled();
    expect(createExpenseDraftMock).not.toHaveBeenCalled();
  });
});

const recordedExpense = {
  ...createdExpense,
  status: "recorded",
  journal_entry_id: TEST_JOURNAL_ENTRY_ID,
};

const validRecordInput = {
  expenseId: TEST_EXPENSE_ID,
  creditAccountId: TEST_CREDIT_ACCOUNT_ID,
};

const GENERIC_RECORD_EXPENSE_ERROR =
  "The expense could not be recorded. Please try again.";

describe("recordExpenseAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    recordExpenseMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    recordExpenseMock.mockResolvedValue(recordedExpense);
  });

  it("rejects invalid expense UUID", async () => {
    const result = await recordExpenseAction({
      ...validRecordInput,
      expenseId: "not-a-uuid",
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        expenseId: "Enter a valid expense identifier.",
      },
      message: GENERIC_RECORD_EXPENSE_ERROR,
    });
    expect(recordExpenseMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects invalid credit account UUID", async () => {
    const result = await recordExpenseAction({
      ...validRecordInput,
      creditAccountId: "bad-id",
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        creditAccountId: "Enter a valid payment account.",
      },
      message: GENERIC_RECORD_EXPENSE_ERROR,
    });
    expect(recordExpenseMock).not.toHaveBeenCalled();
  });

  it("resolves organization server-side", async () => {
    await recordExpenseAction(validRecordInput);

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("expenseId: string");
    expect(contents).toContain("creditAccountId: string");
    expect(contents).not.toMatch(/RecordExpenseActionInput[\s\S]*organizationId:\s*string/);
    expect(contents).toContain("getCurrentOrganizationId()");
  });

  it("calls repository with resolved organization id", async () => {
    await recordExpenseAction(validRecordInput);

    expect(recordExpenseMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      TEST_EXPENSE_ID,
      TEST_CREDIT_ACCOUNT_ID,
    );
  });

  it("maps duplicate-recording error", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Expense is not in draft status",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message:
        "This expense has already been recorded or is no longer editable.",
    });
  });

  it("maps insufficient-role error", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Insufficient role to record expense",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: "You do not have permission to record this expense.",
    });
  });

  it("maps closed-period error", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Accounting period is closed",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message:
        "This expense cannot be recorded because its accounting period is closed.",
    });
  });

  it("maps cross-organization account error", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Credit account does not belong to organization",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message:
        "The selected payment account is not available for this organization.",
    });
  });

  it("maps invalid account-type error", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Credit account type is not allowed",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: "The selected payment account cannot be used for this expense.",
    });
  });

  it("maps expired-session error", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Authenticated user is required",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: "Your session has expired. Please sign in again.",
    });
  });

  it("maps unknown error safely", async () => {
    recordExpenseMock.mockRejectedValue(
      new DataAccessError({
        operation: "recordExpense",
        message: "Journal entry is not balanced",
      }),
    );

    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: false,
      message: GENERIC_RECORD_EXPENSE_ERROR,
    });
    if (!result.success) {
      expect(result.message).not.toContain("Journal entry");
    }
  });

  it('revalidates /expenses on success', async () => {
    await recordExpenseAction(validRecordInput);

    expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
  });

  it(`revalidates /expenses/[id] on success`, async () => {
    await recordExpenseAction(validRecordInput);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      `/expenses/${TEST_EXPENSE_ID}`,
    );
  });

  it("returns success result with recorded status", async () => {
    const result = await recordExpenseAction(validRecordInput);

    expect(result).toEqual({
      success: true,
      expenseId: TEST_EXPENSE_ID,
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
