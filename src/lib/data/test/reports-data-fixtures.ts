import type { ReportsData } from "@/lib/data/reports-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const EMPTY_SNAPSHOTS = {
  recordedGivingTotal: 0,
  nonVoidExpenseTotal: 0,
  openPayablesAmount: 0,
  totalBudgetedAmount: 0,
} as const;

const EMPTY_SUMMARIES = {
  giving: {
    recordedTransactionCount: 0,
    givingThisMonth: 0,
    yearToDateGiving: 0,
  },
  expenses: {
    nonVoidCount: 0,
    totalAmount: 0,
    thisMonthCount: 0,
    amountThisMonth: 0,
  },
  bills: {
    nonVoidCount: 0,
    openCount: 0,
    openAmount: 0,
    paidCount: 0,
  },
  budgets: {
    budgetCount: 0,
    budgetsWithLines: 0,
    totalBudgetedAmount: 0,
  },
  accounting: {
    accountCount: 0,
    accountsByType: [],
    openPeriodCount: 0,
    currentPeriodName: null,
    journalEntryCount: 0,
    postedJournalCount: 0,
    postedDebitTotal: 0,
    postedCreditTotal: 0,
  },
  organization: {
    memberCount: 0,
    vendorCount: 0,
    fundCount: 0,
    fundsWithRecordedGiving: 0,
  },
} as const;

export function createEmptyReportsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): ReportsData {
  return {
    organizationId,
    snapshots: { ...EMPTY_SNAPSHOTS },
    summaries: {
      giving: { ...EMPTY_SUMMARIES.giving },
      expenses: { ...EMPTY_SUMMARIES.expenses },
      bills: { ...EMPTY_SUMMARIES.bills },
      budgets: { ...EMPTY_SUMMARIES.budgets },
      accounting: {
        ...EMPTY_SUMMARIES.accounting,
        accountsByType: [],
      },
      organization: { ...EMPTY_SUMMARIES.organization },
    },
    availableReports: [
      {
        id: "giving-summary",
        name: "Giving Summary",
        description: "Recorded giving totals by month and year-to-date.",
      },
      {
        id: "expense-summary",
        name: "Expense Summary",
        description: "Non-void expense totals and current-month activity.",
      },
      {
        id: "payables-summary",
        name: "Bills / Payables Summary",
        description: "Open payables counts and amounts from bill records.",
      },
      {
        id: "budget-allocation-summary",
        name: "Budget Allocation Summary",
        description: "Budget line totals aggregated across budget plans.",
      },
      {
        id: "accounting-activity-summary",
        name: "Accounting Activity Summary",
        description: "Journal entry counts and posted debit/credit totals.",
      },
    ],
    unavailableReports: [
      {
        id: "trial-balance",
        name: "Trial Balance",
        reason: "Requires ledger balance aggregation across all accounts.",
      },
      {
        id: "balance-sheet",
        name: "Balance Sheet / Statement of Financial Position",
        reason: "Requires account balance aggregation not yet implemented.",
      },
      {
        id: "income-statement",
        name: "Income Statement / Statement of Activities",
        reason: "Requires revenue and expense balance aggregation.",
      },
      {
        id: "cash-flow",
        name: "Cash Flow Statement",
        reason: "Requires cash position and activity classification.",
      },
      {
        id: "fund-balance",
        name: "Fund Balance Report",
        reason: "Requires fund balance aggregation not yet implemented.",
      },
      {
        id: "budget-vs-actual",
        name: "Budget vs Actual",
        reason: "Requires actual-to-budget variance logic not yet implemented.",
      },
    ],
  };
}

export function createPopulatedReportsData(): ReportsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    snapshots: {
      recordedGivingTotal: 5000,
      nonVoidExpenseTotal: 1200,
      openPayablesAmount: 450,
      totalBudgetedAmount: 7500,
    },
    summaries: {
      giving: {
        recordedTransactionCount: 3,
        givingThisMonth: 1500,
        yearToDateGiving: 5000,
      },
      expenses: {
        nonVoidCount: 2,
        totalAmount: 1200,
        thisMonthCount: 1,
        amountThisMonth: 300,
      },
      bills: {
        nonVoidCount: 2,
        openCount: 1,
        openAmount: 450,
        paidCount: 1,
      },
      budgets: {
        budgetCount: 1,
        budgetsWithLines: 1,
        totalBudgetedAmount: 7500,
      },
      accounting: {
        accountCount: 2,
        accountsByType: [
          { accountType: "asset", count: 1 },
          { accountType: "expense", count: 1 },
        ],
        openPeriodCount: 1,
        currentPeriodName: "July 2026",
        journalEntryCount: 2,
        postedJournalCount: 1,
        postedDebitTotal: 150,
        postedCreditTotal: 150,
      },
      organization: {
        memberCount: 10,
        vendorCount: 4,
        fundCount: 2,
        fundsWithRecordedGiving: 1,
      },
    },
    availableReports: createEmptyReportsData().availableReports,
    unavailableReports: createEmptyReportsData().unavailableReports,
  };
}
