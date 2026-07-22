import type { ExpensesData } from "@/lib/data/expenses-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyExpensesData(
  organizationId: string = TEST_ORGANIZATION_ID,
): ExpensesData {
  return {
    organizationId,
    expenses: [],
    counts: {
      total: 0,
      thisMonth: 0,
    },
    summary: {
      totalAmount: 0,
      amountThisMonth: 0,
    },
  };
}

export function createPopulatedExpensesData(): ExpensesData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    expenses: [
      {
        id: "expense-1",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: "vendor-1",
        vendorName: "Northside Supplies",
        expense_date: "2026-07-05",
        description: "Office supplies purchase",
        total_amount: 125.75,
        reference: "EXP-1001",
        payment_source: "card",
        status: "recorded",
        created_at: "2026-07-05T12:00:00.000Z",
        updated_at: "2026-07-05T12:00:00.000Z",
        lineCount: 2,
      },
      {
        id: "expense-2",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: "vendor-2",
        vendorName: "City Utilities",
        expense_date: "2026-07-12",
        description: "Utility reimbursement draft",
        total_amount: 240,
        reference: null,
        payment_source: "reimbursement",
        status: "draft",
        created_at: "2026-07-12T12:00:00.000Z",
        updated_at: "2026-07-12T12:00:00.000Z",
        lineCount: 0,
      },
      {
        id: "expense-3",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: null,
        vendorName: null,
        expense_date: "2026-05-01",
        description: "Voided duplicate entry",
        total_amount: 50,
        reference: "EXP-0990",
        payment_source: "other",
        status: "void",
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-02T12:00:00.000Z",
        lineCount: 0,
      },
    ],
    counts: {
      total: 2,
      thisMonth: 2,
    },
    summary: {
      totalAmount: 365.75,
      amountThisMonth: 365.75,
    },
  };
}
