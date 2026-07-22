import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { sumAmounts, unwrapRows } from "./query-helpers";
import type {
  AccountRow,
  BudgetLineRow,
  BudgetRow,
  FundRow,
} from "./types/rows";

type BudgetLineAggregationRow = Pick<
  BudgetLineRow,
  "budget_id" | "account_id" | "fund_id" | "amount"
>;

export type BudgetFundAllocation = {
  fundId: string;
  fundName: string | null;
  lineCount: number;
  budgetedAmount: number;
};

export type BudgetAccountAllocation = {
  accountId: string;
  accountName: string | null;
  lineCount: number;
  budgetedAmount: number;
};

export type BudgetRecord = BudgetRow & {
  lineCount: number;
  totalBudgetedAmount: number;
  fundAllocations: BudgetFundAllocation[];
  accountAllocations: BudgetAccountAllocation[];
};

export type BudgetsData = {
  organizationId: string;
  budgets: BudgetRecord[];
  counts: {
    total: number;
    withLines: number;
    current: number;
  };
  summary: {
    totalBudgetedAmount: number;
  };
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentBudget(budget: BudgetRow, today: string): boolean {
  return (
    budget.status === "active" &&
    budget.start_date <= today &&
    budget.end_date >= today
  );
}

function buildFundAllocations(
  lines: BudgetLineAggregationRow[],
  fundNames: Map<string, string>,
): BudgetFundAllocation[] {
  const allocations = new Map<
    string,
    { lineCount: number; budgetedAmount: number }
  >();

  for (const line of lines) {
    if (!line.fund_id) {
      continue;
    }

    const current = allocations.get(line.fund_id) ?? {
      lineCount: 0,
      budgetedAmount: 0,
    };
    current.lineCount += 1;
    current.budgetedAmount += Number(line.amount);
    allocations.set(line.fund_id, current);
  }

  return [...allocations.entries()]
    .map(([fundId, metrics]) => ({
      fundId,
      fundName: fundNames.get(fundId) ?? null,
      lineCount: metrics.lineCount,
      budgetedAmount: metrics.budgetedAmount,
    }))
    .sort((left, right) =>
      (left.fundName ?? left.fundId).localeCompare(right.fundName ?? right.fundId),
    );
}

function buildAccountAllocations(
  lines: BudgetLineAggregationRow[],
  accountNames: Map<string, string>,
): BudgetAccountAllocation[] {
  const allocations = new Map<
    string,
    { lineCount: number; budgetedAmount: number }
  >();

  for (const line of lines) {
    const current = allocations.get(line.account_id) ?? {
      lineCount: 0,
      budgetedAmount: 0,
    };
    current.lineCount += 1;
    current.budgetedAmount += Number(line.amount);
    allocations.set(line.account_id, current);
  }

  return [...allocations.entries()]
    .map(([accountId, metrics]) => ({
      accountId,
      accountName: accountNames.get(accountId) ?? null,
      lineCount: metrics.lineCount,
      budgetedAmount: metrics.budgetedAmount,
    }))
    .sort((left, right) =>
      (left.accountName ?? left.accountId).localeCompare(
        right.accountName ?? right.accountId,
      ),
    );
}

function attachBudgetLines(
  budgets: BudgetRow[],
  lines: BudgetLineAggregationRow[],
  fundNames: Map<string, string>,
  accountNames: Map<string, string>,
): BudgetRecord[] {
  const linesByBudget = new Map<string, BudgetLineAggregationRow[]>();

  for (const line of lines) {
    const budgetLines = linesByBudget.get(line.budget_id) ?? [];
    budgetLines.push(line);
    linesByBudget.set(line.budget_id, budgetLines);
  }

  return budgets.map((budget) => {
    const budgetLines = linesByBudget.get(budget.id) ?? [];

    return {
      ...budget,
      lineCount: budgetLines.length,
      totalBudgetedAmount: sumAmounts(
        budgetLines.map((line) => ({ amount: line.amount })),
      ),
      fundAllocations: buildFundAllocations(budgetLines, fundNames),
      accountAllocations: buildAccountAllocations(budgetLines, accountNames),
    };
  });
}

export async function getBudgetsData(
  organizationId: string,
): Promise<BudgetsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getBudgetsData",
  );
  const supabase = await createServerSupabaseClient();
  const today = getTodayDateString();

  const [budgetsResult, fundsResult, accountsResult] = await Promise.all([
    supabase
      .from("budgets")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("start_date", { ascending: false }),
    supabase
      .from("funds")
      .select("id, name")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("accounts")
      .select("id, name")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const budgets = unwrapRows<BudgetRow>("getBudgetsData.budgets", budgetsResult);
  const funds = unwrapRows<Pick<FundRow, "id" | "name">>(
    "getBudgetsData.funds",
    fundsResult,
  );
  const accounts = unwrapRows<Pick<AccountRow, "id" | "name">>(
    "getBudgetsData.accounts",
    accountsResult,
  );

  const budgetIds = budgets.map((budget) => budget.id);
  let budgetLines: BudgetLineAggregationRow[] = [];

  if (budgetIds.length > 0) {
    const budgetIdSet = new Set(budgetIds);
    const budgetLinesResult = await supabase
      .from("budget_lines")
      .select("budget_id, account_id, fund_id, amount")
      .in("budget_id", budgetIds);
    budgetLines = unwrapRows<BudgetLineAggregationRow>(
      "getBudgetsData.budgetLines",
      budgetLinesResult,
    ).filter((line) => budgetIdSet.has(line.budget_id));
  }

  const fundNames = new Map(funds.map((fund) => [fund.id, fund.name]));
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const budgetRecords = attachBudgetLines(
    budgets,
    budgetLines,
    fundNames,
    accountNames,
  );

  return {
    organizationId: scopedOrganizationId,
    budgets: budgetRecords,
    counts: {
      total: budgets.length,
      withLines: budgetRecords.filter((budget) => budget.lineCount > 0).length,
      current: budgets.filter((budget) => isCurrentBudget(budget, today)).length,
    },
    summary: {
      totalBudgetedAmount: sumAmounts(
        budgetLines.map((line) => ({ amount: line.amount })),
      ),
    },
  };
}
