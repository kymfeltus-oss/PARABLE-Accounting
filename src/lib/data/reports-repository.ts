import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import {
  getMonthDateRange,
  getYearToDateRange,
  sumAmounts,
  unwrapRows,
} from "./query-helpers";
import type {
  AccountingPeriodRow,
  AccountRow,
  BillRow,
  BudgetLineRow,
  BudgetRow,
  ExpenseRow,
  FundRow,
  GivingTransactionRow,
  JournalEntryRow,
  MemberRow,
  VendorRow,
} from "./types/rows";

type JournalEntryLineAggregationRow = {
  journal_entry_id: string;
  debit_amount: number | string;
  credit_amount: number | string;
};

type BudgetLineAmountRow = Pick<BudgetLineRow, "budget_id" | "amount">;

type ReportExpenseRow = Pick<
  ExpenseRow,
  "id" | "status" | "total_amount" | "expense_date"
>;

type ReportBillRow = Pick<BillRow, "id" | "status" | "total_amount">;

type ReportBudgetRow = Pick<BudgetRow, "id">;

type ReportAccountingPeriodRow = Pick<
  AccountingPeriodRow,
  "id" | "name" | "start_date" | "end_date" | "status"
>;

export type AccountTypeCount = {
  accountType: string;
  count: number;
};

export type ReportCatalogEntry = {
  id: string;
  name: string;
  description: string;
};

export type UnavailableReportEntry = {
  id: string;
  name: string;
  reason: string;
};

export type ReportsData = {
  organizationId: string;
  snapshots: {
    recordedGivingTotal: number;
    nonVoidExpenseTotal: number;
    openPayablesAmount: number;
    totalBudgetedAmount: number;
  };
  summaries: {
    giving: {
      recordedTransactionCount: number;
      givingThisMonth: number;
      yearToDateGiving: number;
    };
    expenses: {
      nonVoidCount: number;
      totalAmount: number;
      thisMonthCount: number;
      amountThisMonth: number;
    };
    bills: {
      nonVoidCount: number;
      openCount: number;
      openAmount: number;
      paidCount: number;
    };
    budgets: {
      budgetCount: number;
      budgetsWithLines: number;
      totalBudgetedAmount: number;
    };
    accounting: {
      accountCount: number;
      accountsByType: AccountTypeCount[];
      openPeriodCount: number;
      currentPeriodName: string | null;
      journalEntryCount: number;
      postedJournalCount: number;
      postedDebitTotal: number;
      postedCreditTotal: number;
    };
    organization: {
      memberCount: number;
      vendorCount: number;
      fundCount: number;
      fundsWithRecordedGiving: number;
    };
  };
  availableReports: ReportCatalogEntry[];
  unavailableReports: UnavailableReportEntry[];
};

const AVAILABLE_REPORTS: ReportCatalogEntry[] = [
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
];

const UNAVAILABLE_REPORTS: UnavailableReportEntry[] = [
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
];

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isActiveExpense(expense: ReportExpenseRow): boolean {
  return expense.status !== "void";
}

function isExpenseInCurrentMonth(
  expense: ReportExpenseRow,
  startDate: string,
  endDate: string,
): boolean {
  return expense.expense_date >= startDate && expense.expense_date <= endDate;
}

function isOpenBill(bill: ReportBillRow): boolean {
  return bill.status === "draft" || bill.status === "open";
}

function isCurrentPeriod(
  period: ReportAccountingPeriodRow,
  today: string,
): boolean {
  return (
    period.status === "open" &&
    period.start_date <= today &&
    period.end_date >= today
  );
}

function normalizeAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function buildAccountTypeCounts(
  accounts: ReadonlyArray<{ account_type: string }>,
): AccountTypeCount[] {
  const counts = new Map<string, number>();

  for (const account of accounts) {
    counts.set(account.account_type, (counts.get(account.account_type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([accountType, count]) => ({ accountType, count }))
    .sort((left, right) => left.accountType.localeCompare(right.accountType));
}

function sumPostedJournalTotals(
  postedJournalIds: Set<string>,
  lines: JournalEntryLineAggregationRow[],
): { debitTotal: number; creditTotal: number } {
  let debitTotal = 0;
  let creditTotal = 0;

  for (const line of lines) {
    if (!postedJournalIds.has(line.journal_entry_id)) {
      continue;
    }

    debitTotal += normalizeAmount(line.debit_amount);
    creditTotal += normalizeAmount(line.credit_amount);
  }

  return { debitTotal, creditTotal };
}

function sumBudgetLineTotals(
  budgets: ReportBudgetRow[],
  lines: BudgetLineAmountRow[],
): number {
  const budgetIds = new Set(budgets.map((budget) => budget.id));
  const relevantLines = lines.filter((line) => budgetIds.has(line.budget_id));

  return sumAmounts(relevantLines.map((line) => ({ amount: line.amount })));
}

function countBudgetsWithLines(
  budgets: ReportBudgetRow[],
  lines: BudgetLineAmountRow[],
): number {
  const budgetIdsWithLines = new Set(lines.map((line) => line.budget_id));
  return budgets.filter((budget) => budgetIdsWithLines.has(budget.id)).length;
}

export async function getReportsData(
  organizationId: string,
): Promise<ReportsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getReportsData",
  );
  const supabase = await createServerSupabaseClient();
  const today = getTodayDateString();
  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange();
  const { startDate: yearStart, endDate: yearEnd } = getYearToDateRange();

  const [
    givingTransactionsResult,
    expensesResult,
    billsResult,
    budgetsResult,
    journalEntriesResult,
    accountsResult,
    accountingPeriodsResult,
    membersResult,
    vendorsResult,
    fundsResult,
  ] = await Promise.all([
    supabase
      .from("giving_transactions")
      .select("id, status, fund_id, amount, transaction_date")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("expenses")
      .select("id, expense_date, total_amount, status")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("bills")
      .select("id, status, total_amount")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("budgets")
      .select("id")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("journal_entries")
      .select("id, status")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("accounts")
      .select("id, account_type")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("accounting_periods")
      .select("id, name, start_date, end_date, status")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("members")
      .select("id")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("vendors")
      .select("id")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("funds")
      .select("id")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const givingTransactions = unwrapRows<
    Pick<
      GivingTransactionRow,
      "id" | "status" | "fund_id" | "amount" | "transaction_date"
    >
  >("getReportsData.givingTransactions", givingTransactionsResult);
  const expenses = unwrapRows<ReportExpenseRow>(
    "getReportsData.expenses",
    expensesResult,
  );
  const bills = unwrapRows<ReportBillRow>("getReportsData.bills", billsResult);
  const budgets = unwrapRows<ReportBudgetRow>(
    "getReportsData.budgets",
    budgetsResult,
  );
  const journalEntries = unwrapRows<Pick<JournalEntryRow, "id" | "status">>(
    "getReportsData.journalEntries",
    journalEntriesResult,
  );
  const accounts = unwrapRows<Pick<AccountRow, "id" | "account_type">>(
    "getReportsData.accounts",
    accountsResult,
  );
  const accountingPeriods = unwrapRows<ReportAccountingPeriodRow>(
    "getReportsData.accountingPeriods",
    accountingPeriodsResult,
  );
  const members = unwrapRows<Pick<MemberRow, "id">>(
    "getReportsData.members",
    membersResult,
  );
  const vendors = unwrapRows<Pick<VendorRow, "id">>(
    "getReportsData.vendors",
    vendorsResult,
  );
  const funds = unwrapRows<Pick<FundRow, "id">>(
    "getReportsData.funds",
    fundsResult,
  );

  const recordedGivingTransactions = givingTransactions.filter(
    (transaction) => transaction.status === "recorded",
  );
  const recordedGivingTotal = sumAmounts(
    recordedGivingTransactions.map((transaction) => ({
      amount: transaction.amount,
    })),
  );
  const givingThisMonth = sumAmounts(
    recordedGivingTransactions
      .filter(
        (transaction) =>
          transaction.transaction_date >= monthStart &&
          transaction.transaction_date <= monthEnd,
      )
      .map((transaction) => ({ amount: transaction.amount })),
  );
  const yearToDateGiving = sumAmounts(
    recordedGivingTransactions
      .filter(
        (transaction) =>
          transaction.transaction_date >= yearStart &&
          transaction.transaction_date <= yearEnd,
      )
      .map((transaction) => ({ amount: transaction.amount })),
  );

  const budgetIds = budgets.map((budget) => budget.id);
  let budgetLines: BudgetLineAmountRow[] = [];

  if (budgetIds.length > 0) {
    const budgetLinesResult = await supabase
      .from("budget_lines")
      .select("budget_id, amount")
      .in("budget_id", budgetIds);
    budgetLines = unwrapRows<BudgetLineAmountRow>(
      "getReportsData.budgetLines",
      budgetLinesResult,
    );
  }

  const postedJournalEntries = journalEntries.filter(
    (entry) => entry.status === "posted",
  );
  const postedJournalIds = new Set(
    postedJournalEntries.map((entry) => entry.id),
  );
  let journalLines: JournalEntryLineAggregationRow[] = [];

  if (postedJournalIds.size > 0) {
    const journalLinesResult = await supabase
      .from("journal_entry_lines")
      .select("journal_entry_id, debit_amount, credit_amount")
      .in("journal_entry_id", [...postedJournalIds]);
    journalLines = unwrapRows<JournalEntryLineAggregationRow>(
      "getReportsData.journalLines",
      journalLinesResult,
    ).filter((line) => postedJournalIds.has(line.journal_entry_id));
  }

  const activeExpenses = expenses.filter(isActiveExpense);
  const thisMonthExpenses = activeExpenses.filter((expense) =>
    isExpenseInCurrentMonth(expense, monthStart, monthEnd),
  );
  const activeBills = bills.filter((bill) => bill.status !== "void");
  const openBills = bills.filter(isOpenBill);
  const paidBills = bills.filter((bill) => bill.status === "paid");
  const totalBudgetedAmount = sumBudgetLineTotals(budgets, budgetLines);
  const postedJournalTotals = sumPostedJournalTotals(postedJournalIds, journalLines);
  const fundsWithRecordedGiving = new Set(
    recordedGivingTransactions
      .map((transaction) => transaction.fund_id)
      .filter((fundId): fundId is string => fundId !== null),
  ).size;
  const currentPeriod = accountingPeriods.find((period) =>
    isCurrentPeriod(period, today),
  );

  return {
    organizationId: scopedOrganizationId,
    snapshots: {
      recordedGivingTotal,
      nonVoidExpenseTotal: sumAmounts(
        activeExpenses.map((expense) => ({ amount: expense.total_amount })),
      ),
      openPayablesAmount: sumAmounts(
        openBills.map((bill) => ({ amount: bill.total_amount })),
      ),
      totalBudgetedAmount,
    },
    summaries: {
      giving: {
        recordedTransactionCount: recordedGivingTransactions.length,
        givingThisMonth,
        yearToDateGiving,
      },
      expenses: {
        nonVoidCount: activeExpenses.length,
        totalAmount: sumAmounts(
          activeExpenses.map((expense) => ({ amount: expense.total_amount })),
        ),
        thisMonthCount: thisMonthExpenses.length,
        amountThisMonth: sumAmounts(
          thisMonthExpenses.map((expense) => ({ amount: expense.total_amount })),
        ),
      },
      bills: {
        nonVoidCount: activeBills.length,
        openCount: openBills.length,
        openAmount: sumAmounts(
          openBills.map((bill) => ({ amount: bill.total_amount })),
        ),
        paidCount: paidBills.length,
      },
      budgets: {
        budgetCount: budgets.length,
        budgetsWithLines: countBudgetsWithLines(budgets, budgetLines),
        totalBudgetedAmount,
      },
      accounting: {
        accountCount: accounts.length,
        accountsByType: buildAccountTypeCounts(accounts),
        openPeriodCount: accountingPeriods.filter(
          (period) => period.status === "open",
        ).length,
        currentPeriodName: currentPeriod?.name ?? null,
        journalEntryCount: journalEntries.length,
        postedJournalCount: postedJournalEntries.length,
        postedDebitTotal: postedJournalTotals.debitTotal,
        postedCreditTotal: postedJournalTotals.creditTotal,
      },
      organization: {
        memberCount: members.length,
        vendorCount: vendors.length,
        fundCount: funds.length,
        fundsWithRecordedGiving,
      },
    },
    availableReports: AVAILABLE_REPORTS,
    unavailableReports: UNAVAILABLE_REPORTS,
  };
}
