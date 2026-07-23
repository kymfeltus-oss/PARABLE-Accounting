import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountingData } from "@/lib/data/accounting-repository";
import type { FundsData } from "@/lib/data/funds-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getExpenseByIdMock,
  getExpenseLinesMock,
  getAccountingDataMock,
  getFundsDataMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getExpenseByIdMock: vi.fn(),
  getExpenseLinesMock: vi.fn(),
  getAccountingDataMock: vi.fn(),
  getFundsDataMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/expenses-repository", () => ({
  getExpenseById: getExpenseByIdMock,
  getExpenseLines: getExpenseLinesMock,
}));

vi.mock("@/lib/data/accounting-repository", () => ({
  getAccountingData: getAccountingDataMock,
}));

vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: getFundsDataMock,
}));

import ExpenseDetailPage from "./page";
import { ExpenseDetailPageContent } from "@/components/expenses/expense-detail-page-content";

const VALID_EXPENSE_ID = "66666666-6666-4666-8666-666666666666";
const accountTimestamp = "2026-01-01T12:00:00.000Z";
const fundTimestamp = "2026-06-01T12:00:00.000Z";

function createExpenseRecord() {
  return {
    id: VALID_EXPENSE_ID,
    organization_id: TEST_ORGANIZATION_ID,
    vendor_id: "vendor-1",
    vendorName: "Northside Supplies",
    expense_date: "2026-07-05",
    description: "Office supplies purchase",
    total_amount: 125.75,
    reference: "EXP-1001",
    payment_source: "card",
    status: "draft",
    created_at: "2026-07-05T12:00:00.000Z",
    updated_at: "2026-07-05T12:00:00.000Z",
    lineCount: 1,
  };
}

function createAccountingData(): AccountingData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    accounts: [
      {
        id: "acct-expense-active",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "6100",
        name: "Utilities",
        account_type: "expense",
        is_posting: true,
        status: "active",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
    ],
    periods: [],
    journalEntries: [],
    counts: {
      totalAccounts: 1,
      activeAccounts: 1,
      openPeriods: 0,
      closedPeriods: 0,
      postedJournalEntries: 0,
      draftJournalEntries: 0,
    },
  };
}

function createFundsData(): FundsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    funds: [
      {
        id: "fund-active-coded",
        organization_id: TEST_ORGANIZATION_ID,
        name: "General Fund",
        code: "GEN",
        fund_type: "unrestricted",
        status: "active",
        created_at: fundTimestamp,
        updated_at: fundTimestamp,
        givingTransactionCount: 0,
        givingTotalAmount: 0,
        expenseLineCount: 0,
        expenseAllocationTotal: 0,
        billLineCount: 0,
        billAllocationTotal: 0,
        budgetLineCount: 0,
        budgetAllocationTotal: 0,
      },
    ],
    counts: {
      total: 1,
      withGiving: 0,
      withExpenses: 0,
      withBudgetAllocations: 0,
    },
  };
}

describe("Expense detail page wiring", () => {
  beforeEach(() => {
    getCurrentOrganizationIdMock.mockReset();
    getExpenseByIdMock.mockReset();
    getExpenseLinesMock.mockReset();
    getAccountingDataMock.mockReset();
    getFundsDataMock.mockReset();
    notFoundMock.mockClear();
  });
  it("renders the detail page for a valid expense", async () => {
    const expense = createExpenseRecord();
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpenseByIdMock.mockResolvedValue(expense);
    getExpenseLinesMock.mockResolvedValue([]);
    getAccountingDataMock.mockResolvedValue(createAccountingData());
    getFundsDataMock.mockResolvedValue(createFundsData());

    const page = await ExpenseDetailPage({
      params: Promise.resolve({ id: VALID_EXPENSE_ID }),
    });

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getExpenseByIdMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_EXPENSE_ID,
    );
    expect(getExpenseLinesMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_EXPENSE_ID,
    );
    expect(page.type).toBe(ExpenseDetailPageContent);
    expect(page.props.expense).toEqual(expense);
  });

  it("calls notFound for a missing expense", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpenseByIdMock.mockResolvedValue(null);

    await expect(
      ExpenseDetailPage({
        params: Promise.resolve({ id: VALID_EXPENSE_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getExpenseLinesMock).not.toHaveBeenCalled();
  });

  it("calls notFound when the expense belongs to another organization", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpenseByIdMock.mockResolvedValue(null);

    await expect(
      ExpenseDetailPage({
        params: Promise.resolve({ id: VALID_EXPENSE_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(getExpenseByIdMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      VALID_EXPENSE_ID,
    );
  });

  it("calls notFound for an invalid UUID route parameter", async () => {
    await expect(
      ExpenseDetailPage({
        params: Promise.resolve({ id: "not-a-valid-uuid" }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(getExpenseByIdMock).not.toHaveBeenCalled();
  });

  it("calls notFound for void expenses", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpenseByIdMock.mockResolvedValue({
      ...createExpenseRecord(),
      status: "void",
    });

    await expect(
      ExpenseDetailPage({
        params: Promise.resolve({ id: VALID_EXPENSE_ID }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(getExpenseLinesMock).not.toHaveBeenCalled();
  });
});
