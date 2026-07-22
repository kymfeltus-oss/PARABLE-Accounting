import type { FundsData } from "@/lib/data/funds-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyFundsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): FundsData {
  return {
    organizationId,
    funds: [],
    counts: {
      total: 0,
      withGiving: 0,
      withExpenses: 0,
      withBudgetAllocations: 0,
    },
  };
}

export function createPopulatedFundsData(): FundsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    funds: [
      {
        id: "fund-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "General Fund",
        code: "GEN",
        fund_type: "unrestricted",
        status: "active",
        created_at: "2026-06-01T12:00:00.000Z",
        updated_at: "2026-06-01T12:00:00.000Z",
        givingTransactionCount: 3,
        givingTotalAmount: 1500,
        expenseLineCount: 2,
        expenseAllocationTotal: 425.5,
        billLineCount: 1,
        billAllocationTotal: 200,
        budgetLineCount: 1,
        budgetAllocationTotal: 5000,
      },
      {
        id: "fund-2",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Building Fund",
        code: "BLD",
        fund_type: "temporarily_restricted",
        status: "active",
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-01T12:00:00.000Z",
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
      total: 2,
      withGiving: 1,
      withExpenses: 1,
      withBudgetAllocations: 1,
    },
  };
}
