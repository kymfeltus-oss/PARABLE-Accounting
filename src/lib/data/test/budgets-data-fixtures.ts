import type { BudgetsData } from "@/lib/data/budgets-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyBudgetsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): BudgetsData {
  return {
    organizationId,
    budgets: [],
    accounts: [],
    funds: [],
    budgetVsActual: null,
    counts: {
      total: 0,
      withLines: 0,
      current: 0,
    },
    summary: {
      totalBudgetedAmount: 0,
    },
  };
}

export function createPopulatedBudgetsData(): BudgetsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    accounts: [
      {
        id: "account-1",
        code: "5100",
        name: "Office Expense",
        account_type: "expense",
      },
      {
        id: "account-2",
        code: "5200",
        name: "Utilities",
        account_type: "expense",
      },
    ],
    funds: [{ id: "fund-1", name: "General Fund" }],
    budgetVsActual: {
      budgetId: "budget-1",
      budgetName: "FY 2026 Operating Budget",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      rows: [
        {
          accountId: "account-1",
          accountCode: "5100",
          accountName: "Office Expense",
          accountType: "expense",
          fundId: "fund-1",
          fundName: "General Fund",
          budgetedAmount: 2500,
          actualAmount: 1800,
          variance: 700,
        },
        {
          accountId: "account-2",
          accountCode: "5200",
          accountName: "Utilities",
          accountType: "expense",
          fundId: "fund-1",
          fundName: "General Fund",
          budgetedAmount: 5000,
          actualAmount: 4200,
          variance: 800,
        },
      ],
      totalBudgeted: 7500,
      totalActual: 6000,
      totalVariance: 1500,
    },
    budgets: [
      {
        id: "budget-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "FY 2026 Operating Budget",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: "active",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
        lineCount: 2,
        totalBudgetedAmount: 7500,
        budgetVsActual: {
          budgetId: "budget-1",
          budgetName: "FY 2026 Operating Budget",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          rows: [
            {
              accountId: "account-1",
              accountCode: "5100",
              accountName: "Office Expense",
              accountType: "expense",
              fundId: "fund-1",
              fundName: "General Fund",
              budgetedAmount: 2500,
              actualAmount: 1800,
              variance: 700,
            },
            {
              accountId: "account-2",
              accountCode: "5200",
              accountName: "Utilities",
              accountType: "expense",
              fundId: "fund-1",
              fundName: "General Fund",
              budgetedAmount: 5000,
              actualAmount: 4200,
              variance: 800,
            },
          ],
          totalBudgeted: 7500,
          totalActual: 6000,
          totalVariance: 1500,
        },
        fundAllocations: [
          {
            fundId: "fund-1",
            fundName: "General Fund",
            lineCount: 2,
            budgetedAmount: 7500,
          },
        ],
        accountAllocations: [
          {
            accountId: "account-1",
            accountName: "Office Expense",
            lineCount: 1,
            budgetedAmount: 2500,
          },
          {
            accountId: "account-2",
            accountName: "Utilities",
            lineCount: 1,
            budgetedAmount: 5000,
          },
        ],
      },
      {
        id: "budget-2",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Draft Capital Plan",
        start_date: "2027-01-01",
        end_date: "2027-12-31",
        status: "draft",
        created_at: "2026-06-01T12:00:00.000Z",
        updated_at: "2026-06-01T12:00:00.000Z",
        lineCount: 0,
        totalBudgetedAmount: 0,
        budgetVsActual: null,
        fundAllocations: [],
        accountAllocations: [],
      },
    ],
    counts: {
      total: 2,
      withLines: 1,
      current: 1,
    },
    summary: {
      totalBudgetedAmount: 7500,
    },
  };
}
