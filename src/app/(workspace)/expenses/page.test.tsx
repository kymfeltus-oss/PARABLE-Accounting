import { describe, expect, it, vi } from "vitest";

import type { AccountingData } from "@/lib/data/accounting-repository";
import type { FundsData } from "@/lib/data/funds-repository";
import { createEmptyExpensesData } from "@/lib/data/test/expenses-data-fixtures";
import {
  createEmptyVendorsData,
  createPopulatedVendorsData,
} from "@/lib/data/test/vendors-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getExpensesDataMock,
  getVendorsDataMock,
  getAccountingDataMock,
  getFundsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getExpensesDataMock: vi.fn(),
  getVendorsDataMock: vi.fn(),
  getAccountingDataMock: vi.fn(),
  getFundsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/expenses-repository", () => ({
  getExpensesData: getExpensesDataMock,
  getExpenseDraftLines: vi.fn(),
}));

vi.mock("@/lib/data/vendors-repository", () => ({
  getVendorsData: getVendorsDataMock,
}));

vi.mock("@/lib/data/accounting-repository", () => ({
  getAccountingData: getAccountingDataMock,
}));

vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: getFundsDataMock,
}));

import ExpensesPage from "./page";
import { ExpensesPageContent } from "@/components/expenses/expenses-page-content";
import { getExpenseDraftLines } from "@/lib/data/expenses-repository";

const accountTimestamp = "2026-01-01T12:00:00.000Z";
const fundTimestamp = "2026-06-01T12:00:00.000Z";

function createEmptyFundMetrics() {
  return {
    givingTransactionCount: 0,
    givingTotalAmount: 0,
    expenseLineCount: 0,
    expenseAllocationTotal: 0,
    billLineCount: 0,
    billAllocationTotal: 0,
    budgetLineCount: 0,
    budgetAllocationTotal: 0,
  };
}

function createAccountingDataForExpenseOptions(): AccountingData {
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
      {
        id: "acct-asset",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "1000",
        name: "Operating Cash",
        account_type: "asset",
        is_posting: true,
        status: "active",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
      {
        id: "acct-liability",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "2000",
        name: "Payables",
        account_type: "liability",
        is_posting: true,
        status: "active",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
      {
        id: "acct-revenue",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "4000",
        name: "Donations",
        account_type: "revenue",
        is_posting: true,
        status: "active",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
      {
        id: "acct-net-asset",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "3000",
        name: "Net Assets",
        account_type: "net_asset",
        is_posting: true,
        status: "active",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
      {
        id: "acct-expense-inactive",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "6200",
        name: "Old Expense",
        account_type: "expense",
        is_posting: true,
        status: "inactive",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
      {
        id: "acct-expense-header",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "6000",
        name: "Expense Header",
        account_type: "expense",
        is_posting: false,
        status: "active",
        created_at: accountTimestamp,
        updated_at: accountTimestamp,
      },
    ],
    periods: [],
    journalEntries: [],
    counts: {
      totalAccounts: 7,
      activeAccounts: 6,
      openPeriods: 0,
      closedPeriods: 0,
      postedJournalEntries: 0,
      draftJournalEntries: 0,
    },
  };
}

function createFundsDataForExpenseOptions(): FundsData {
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
        ...createEmptyFundMetrics(),
      },
      {
        id: "fund-active-uncoded",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Mission Fund",
        code: null,
        fund_type: "unrestricted",
        status: "active",
        created_at: fundTimestamp,
        updated_at: fundTimestamp,
        ...createEmptyFundMetrics(),
      },
      {
        id: "fund-inactive",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Closed Fund",
        code: "CLS",
        fund_type: "unrestricted",
        status: "inactive",
        created_at: fundTimestamp,
        updated_at: fundTimestamp,
        ...createEmptyFundMetrics(),
      },
    ],
    counts: {
      total: 3,
      withGiving: 0,
      withExpenses: 0,
      withBudgetAllocations: 0,
    },
  };
}

describe("Expenses page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to data repositories", async () => {
    const expensesData = createEmptyExpensesData(TEST_ORGANIZATION_ID);
    const vendorsData = createEmptyVendorsData(TEST_ORGANIZATION_ID);
    const accountingData = createAccountingDataForExpenseOptions();
    const fundsData = createFundsDataForExpenseOptions();
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(expensesData);
    getVendorsDataMock.mockResolvedValue(vendorsData);
    getAccountingDataMock.mockResolvedValue(accountingData);
    getFundsDataMock.mockResolvedValue(fundsData);

    await ExpensesPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getExpensesDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(getVendorsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(getAccountingDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(getFundsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned expenses data and mapped vendor options to ExpensesPageContent", async () => {
    const expensesData = createEmptyExpensesData(TEST_ORGANIZATION_ID);
    const vendorsData = createPopulatedVendorsData();
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(expensesData);
    getVendorsDataMock.mockResolvedValue(vendorsData);
    getAccountingDataMock.mockResolvedValue(createAccountingDataForExpenseOptions());
    getFundsDataMock.mockResolvedValue(createFundsDataForExpenseOptions());

    const page = await ExpensesPage();

    expect(page.type).toBe(ExpensesPageContent);
    expect(page.props.data).toEqual(expensesData);
    expect(page.props.vendorOptions).toEqual([
      { id: "vendor-1", name: "Northside Supplies" },
      { id: "vendor-2", name: "City Utilities" },
    ]);
  });

  it("includes only eligible active posting expense accounts in accountOptions", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(createEmptyExpensesData(TEST_ORGANIZATION_ID));
    getVendorsDataMock.mockResolvedValue(createEmptyVendorsData(TEST_ORGANIZATION_ID));
    getAccountingDataMock.mockResolvedValue(createAccountingDataForExpenseOptions());
    getFundsDataMock.mockResolvedValue(createFundsDataForExpenseOptions());

    const page = await ExpensesPage();

    expect(page.props.accountOptions).toEqual([
      {
        id: "acct-expense-active",
        code: "6100",
        name: "Utilities",
        label: "6100 · Utilities",
      },
    ]);
    expect(page.props.accountOptions.map((option: { id: string }) => option.id)).not.toContain(
      "acct-asset",
    );
    expect(page.props.accountOptions.map((option: { id: string }) => option.id)).not.toContain(
      "acct-liability",
    );
    expect(page.props.accountOptions.map((option: { id: string }) => option.id)).not.toContain(
      "acct-revenue",
    );
    expect(page.props.accountOptions.map((option: { id: string }) => option.id)).not.toContain(
      "acct-net-asset",
    );
    expect(page.props.accountOptions.map((option: { id: string }) => option.id)).not.toContain(
      "acct-expense-inactive",
    );
    expect(page.props.accountOptions.map((option: { id: string }) => option.id)).not.toContain(
      "acct-expense-header",
    );
  });

  it("includes only active funds with coded and uncoded labels in fundOptions", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(createEmptyExpensesData(TEST_ORGANIZATION_ID));
    getVendorsDataMock.mockResolvedValue(createEmptyVendorsData(TEST_ORGANIZATION_ID));
    getAccountingDataMock.mockResolvedValue(createAccountingDataForExpenseOptions());
    getFundsDataMock.mockResolvedValue(createFundsDataForExpenseOptions());

    const page = await ExpensesPage();

    expect(page.props.fundOptions).toEqual([
      {
        id: "fund-active-coded",
        code: "GEN",
        name: "General Fund",
        label: "GEN · General Fund",
      },
      {
        id: "fund-active-uncoded",
        code: null,
        name: "Mission Fund",
        label: "Mission Fund",
      },
    ]);
    expect(page.props.fundOptions.map((option: { id: string }) => option.id)).not.toContain(
      "fund-inactive",
    );
  });

  it("does not preload allocation lines or call getExpenseDraftLines from the page", async () => {
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(createEmptyExpensesData(TEST_ORGANIZATION_ID));
    getVendorsDataMock.mockResolvedValue(createEmptyVendorsData(TEST_ORGANIZATION_ID));
    getAccountingDataMock.mockResolvedValue(createAccountingDataForExpenseOptions());
    getFundsDataMock.mockResolvedValue(createFundsDataForExpenseOptions());

    await ExpensesPage();

    expect(getExpenseDraftLines).not.toHaveBeenCalled();
  });
});
