import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { BillRow, ExpenseRow, FundRow } from "./types/rows";

type GivingFundAggregationRow = {
  fund_id: string | null;
  amount: number | string;
  status: string;
};

type ExpenseStatusRow = Pick<ExpenseRow, "id" | "status">;
type BillStatusRow = Pick<BillRow, "id" | "status">;

type ExpenseLineFundAggregationRow = {
  expense_id: string;
  fund_id: string | null;
  amount: number | string;
};

type BillLineFundAggregationRow = {
  bill_id: string;
  fund_id: string | null;
  amount: number | string;
};

type BudgetLineFundAggregationRow = {
  fund_id: string | null;
  amount: number | string;
};

export type FundRecord = FundRow & {
  givingTransactionCount: number;
  givingTotalAmount: number;
  expenseLineCount: number;
  expenseAllocationTotal: number;
  billLineCount: number;
  billAllocationTotal: number;
  budgetLineCount: number;
  budgetAllocationTotal: number;
};

export type FundsData = {
  organizationId: string;
  funds: FundRecord[];
  counts: {
    total: number;
    withGiving: number;
    withExpenses: number;
    withBudgetAllocations: number;
  };
};

type FundMetrics = {
  givingTransactionCount: number;
  givingTotalAmount: number;
  expenseLineCount: number;
  expenseAllocationTotal: number;
  billLineCount: number;
  billAllocationTotal: number;
  budgetLineCount: number;
  budgetAllocationTotal: number;
};

function createEmptyFundMetrics(): FundMetrics {
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

function buildFundMetrics(
  funds: FundRow[],
  givingTransactions: GivingFundAggregationRow[],
  expenseLines: ExpenseLineFundAggregationRow[],
  billLines: BillLineFundAggregationRow[],
  budgetLines: BudgetLineFundAggregationRow[],
): Map<string, FundMetrics> {
  const metrics = new Map<string, FundMetrics>(
    funds.map((fund) => [fund.id, createEmptyFundMetrics()]),
  );

  for (const transaction of givingTransactions) {
    if (!transaction.fund_id) {
      continue;
    }

    const fundMetrics = metrics.get(transaction.fund_id);

    if (!fundMetrics) {
      continue;
    }

    fundMetrics.givingTransactionCount += 1;
    fundMetrics.givingTotalAmount += Number(transaction.amount);
  }

  for (const line of expenseLines) {
    if (!line.fund_id) {
      continue;
    }

    const fundMetrics = metrics.get(line.fund_id);

    if (!fundMetrics) {
      continue;
    }

    fundMetrics.expenseLineCount += 1;
    fundMetrics.expenseAllocationTotal += Number(line.amount);
  }

  for (const line of billLines) {
    if (!line.fund_id) {
      continue;
    }

    const fundMetrics = metrics.get(line.fund_id);

    if (!fundMetrics) {
      continue;
    }

    fundMetrics.billLineCount += 1;
    fundMetrics.billAllocationTotal += Number(line.amount);
  }

  for (const line of budgetLines) {
    if (!line.fund_id) {
      continue;
    }

    const fundMetrics = metrics.get(line.fund_id);

    if (!fundMetrics) {
      continue;
    }

    fundMetrics.budgetLineCount += 1;
    fundMetrics.budgetAllocationTotal += Number(line.amount);
  }

  return metrics;
}

function attachFundMetrics(
  funds: FundRow[],
  metrics: Map<string, FundMetrics>,
): FundRecord[] {
  return funds.map((fund) => {
    const fundMetrics = metrics.get(fund.id) ?? createEmptyFundMetrics();

    return {
      ...fund,
      ...fundMetrics,
    };
  });
}

export async function getFundsData(organizationId: string): Promise<FundsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getFundsData",
  );
  const supabase = await createServerSupabaseClient();

  const [
    fundsResult,
    givingResult,
    expensesResult,
    billsResult,
    budgetsResult,
  ] = await Promise.all([
    supabase
      .from("funds")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("name", { ascending: true }),
    supabase
      .from("giving_transactions")
      .select("fund_id, amount, status")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "recorded"),
    supabase
      .from("expenses")
      .select("id, status")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("bills")
      .select("id, status")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("budgets")
      .select("id")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const funds = unwrapRows<FundRow>("getFundsData.funds", fundsResult);
  const givingTransactions = unwrapRows<GivingFundAggregationRow>(
    "getFundsData.givingTransactions",
    givingResult,
  );
  const expenses = unwrapRows<ExpenseStatusRow>(
    "getFundsData.expenses",
    expensesResult,
  );
  const bills = unwrapRows<BillStatusRow>("getFundsData.bills", billsResult);
  const budgets = unwrapRows<{ id: string }>(
    "getFundsData.budgets",
    budgetsResult,
  );

  const activeExpenseIds = expenses
    .filter((expense) => expense.status !== "void")
    .map((expense) => expense.id);
  const activeBillIds = bills
    .filter((bill) => bill.status !== "void")
    .map((bill) => bill.id);
  const budgetIds = budgets.map((budget) => budget.id);

  let expenseLines: ExpenseLineFundAggregationRow[] = [];
  let billLines: BillLineFundAggregationRow[] = [];
  let budgetLines: BudgetLineFundAggregationRow[] = [];

  if (activeExpenseIds.length > 0) {
    const activeExpenseIdSet = new Set(activeExpenseIds);
    const expenseLinesResult = await supabase
      .from("expense_lines")
      .select("expense_id, fund_id, amount")
      .in("expense_id", activeExpenseIds);
    expenseLines = unwrapRows<ExpenseLineFundAggregationRow>(
      "getFundsData.expenseLines",
      expenseLinesResult,
    ).filter((line) => activeExpenseIdSet.has(line.expense_id));
  }

  if (activeBillIds.length > 0) {
    const activeBillIdSet = new Set(activeBillIds);
    const billLinesResult = await supabase
      .from("bill_lines")
      .select("bill_id, fund_id, amount")
      .in("bill_id", activeBillIds);
    billLines = unwrapRows<BillLineFundAggregationRow>(
      "getFundsData.billLines",
      billLinesResult,
    ).filter((line) => activeBillIdSet.has(line.bill_id));
  }

  if (budgetIds.length > 0) {
    const budgetLinesResult = await supabase
      .from("budget_lines")
      .select("fund_id, amount")
      .in("budget_id", budgetIds);
    budgetLines = unwrapRows<BudgetLineFundAggregationRow>(
      "getFundsData.budgetLines",
      budgetLinesResult,
    );
  }

  const metrics = buildFundMetrics(
    funds,
    givingTransactions,
    expenseLines,
    billLines,
    budgetLines,
  );
  const fundRecords = attachFundMetrics(funds, metrics);

  return {
    organizationId: scopedOrganizationId,
    funds: fundRecords,
    counts: {
      total: funds.length,
      withGiving: fundRecords.filter((fund) => fund.givingTransactionCount > 0)
        .length,
      withExpenses: fundRecords.filter((fund) => fund.expenseLineCount > 0)
        .length,
      withBudgetAllocations: fundRecords.filter(
        (fund) => fund.budgetLineCount > 0,
      ).length,
    },
  };
}
