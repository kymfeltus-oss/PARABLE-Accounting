import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import {
  buildBudgetVsActualReport,
  type BudgetLineInput,
  type BudgetVsActualReport,
  type LedgerLineInput,
} from "./ledger-balances";
import { loadLedgerBalanceContext } from "./ledger-balances-repository";
import { requireOrganizationId } from "./organization-id";
import { sumAmounts, toDataAccessError, unwrapRows } from "./query-helpers";
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

type BudgetLineDetailRow = Pick<
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
  budgetVsActual: BudgetVsActualReport | null;
};

export type BudgetFormAccount = Pick<
  AccountRow,
  "id" | "code" | "name" | "account_type"
>;

export type BudgetFormFund = Pick<FundRow, "id" | "name">;

export type BudgetsData = {
  organizationId: string;
  budgets: BudgetRecord[];
  accounts: BudgetFormAccount[];
  funds: BudgetFormFund[];
  budgetVsActual: BudgetVsActualReport | null;
  counts: {
    total: number;
    withLines: number;
    current: number;
  };
  summary: {
    totalBudgetedAmount: number;
  };
};

export type CreateBudgetInput = {
  name: string;
  startDate: string;
  endDate: string;
  status?: string | null;
};

export type UpsertBudgetLineInput = {
  budgetId: string;
  accountId: string;
  amount: number;
  fundId?: string | null;
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

function requireBudgetName(name: string, operation: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "name is required",
    });
  }

  return trimmed;
}

function requireBudgetDates(
  startDate: string,
  endDate: string,
  operation: string,
): { startDate: string; endDate: string } {
  const trimmedStart = startDate.trim();
  const trimmedEnd = endDate.trim();

  if (!trimmedStart || !trimmedEnd) {
    throw new DataAccessError({
      operation,
      message: "dates are required",
    });
  }

  if (trimmedStart > trimmedEnd) {
    throw new DataAccessError({
      operation,
      message: "start date must be on or before end date",
    });
  }

  return { startDate: trimmedStart, endDate: trimmedEnd };
}

function requireBudgetId(budgetId: string, operation: string): string {
  const trimmed = budgetId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "budgetId is required",
    });
  }

  return trimmed;
}

function requireAccountId(accountId: string, operation: string): string {
  const trimmed = accountId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "accountId is required",
    });
  }

  return trimmed;
}

function requireNonNegativeAmount(amount: number, operation: string): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new DataAccessError({
      operation,
      message: "amount must be zero or greater",
    });
  }

  return amount;
}

function toBudgetRecord(
  budget: BudgetRow,
  metrics: Omit<
    BudgetRecord,
    keyof BudgetRow | "budgetVsActual"
  > & { budgetVsActual?: BudgetVsActualReport | null },
): BudgetRecord {
  return {
    ...budget,
    lineCount: metrics.lineCount,
    totalBudgetedAmount: metrics.totalBudgetedAmount,
    fundAllocations: metrics.fundAllocations,
    accountAllocations: metrics.accountAllocations,
    budgetVsActual: metrics.budgetVsActual ?? null,
  };
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
        right.accountName ?? left.accountId,
      ),
    );
}

function buildBudgetLineInputs(
  lines: BudgetLineDetailRow[],
  accounts: BudgetFormAccount[],
  funds: BudgetFormFund[],
): BudgetLineInput[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const fundNames = new Map(funds.map((fund) => [fund.id, fund.name]));
  const inputs: BudgetLineInput[] = [];

  for (const line of lines) {
    const account = accountById.get(line.account_id);

    if (
      !account ||
      (account.account_type !== "expense" && account.account_type !== "revenue")
    ) {
      continue;
    }

    inputs.push({
      accountId: line.account_id,
      accountType: account.account_type,
      accountCode: account.code,
      accountName: account.name,
      fundId: line.fund_id,
      fundName: line.fund_id ? (fundNames.get(line.fund_id) ?? null) : null,
      budgetedAmount: Number(line.amount),
    });
  }

  return inputs;
}

function buildBudgetVsActualForBudget(
  budget: BudgetRow,
  lines: BudgetLineDetailRow[],
  accounts: BudgetFormAccount[],
  funds: BudgetFormFund[],
  ledgerLines: LedgerLineInput[],
): BudgetVsActualReport | null {
  if (budget.status !== "active" || lines.length === 0) {
    return null;
  }

  const budgetLineInputs = buildBudgetLineInputs(lines, accounts, funds);

  if (budgetLineInputs.length === 0) {
    return null;
  }

  return buildBudgetVsActualReport(
    {
      id: budget.id,
      name: budget.name,
      startDate: budget.start_date,
      endDate: budget.end_date,
    },
    budgetLineInputs,
    ledgerLines,
  );
}

function attachBudgetLines(
  budgets: BudgetRow[],
  lines: BudgetLineDetailRow[],
  fundNames: Map<string, string>,
  accountNames: Map<string, string>,
  accounts: BudgetFormAccount[],
  funds: BudgetFormFund[],
  ledgerLines: LedgerLineInput[],
): BudgetRecord[] {
  const linesByBudget = new Map<string, BudgetLineDetailRow[]>();

  for (const line of lines) {
    const budgetLines = linesByBudget.get(line.budget_id) ?? [];
    budgetLines.push(line);
    linesByBudget.set(line.budget_id, budgetLines);
  }

  return budgets.map((budget) => {
    const budgetLines = linesByBudget.get(budget.id) ?? [];

    return toBudgetRecord(budget, {
      lineCount: budgetLines.length,
      totalBudgetedAmount: sumAmounts(
        budgetLines.map((line) => ({ amount: line.amount })),
      ),
      fundAllocations: buildFundAllocations(budgetLines, fundNames),
      accountAllocations: buildAccountAllocations(budgetLines, accountNames),
      budgetVsActual: buildBudgetVsActualForBudget(
        budget,
        budgetLines,
        accounts,
        funds,
        ledgerLines,
      ),
    });
  });
}

function selectCurrentBudgetVsActual(
  budgets: BudgetRecord[],
  today: string,
): BudgetVsActualReport | null {
  const currentBudget = budgets.find(
    (budget) =>
      budget.status === "active" &&
      budget.start_date <= today &&
      budget.end_date >= today &&
      budget.budgetVsActual !== null,
  );

  return currentBudget?.budgetVsActual ?? null;
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
      .eq("organization_id", scopedOrganizationId)
      .order("name", { ascending: true }),
    supabase
      .from("accounts")
      .select("id, code, name, account_type")
      .eq("organization_id", scopedOrganizationId)
      .in("account_type", ["expense", "revenue"])
      .order("code", { ascending: true }),
  ]);

  const budgets = unwrapRows<BudgetRow>("getBudgetsData.budgets", budgetsResult);
  const funds = unwrapRows<BudgetFormFund>("getBudgetsData.funds", fundsResult);
  const accounts = unwrapRows<BudgetFormAccount>(
    "getBudgetsData.accounts",
    accountsResult,
  );

  const budgetIds = budgets.map((budget) => budget.id);
  let budgetLines: BudgetLineDetailRow[] = [];

  if (budgetIds.length > 0) {
    const budgetIdSet = new Set(budgetIds);
    const budgetLinesResult = await supabase
      .from("budget_lines")
      .select("budget_id, account_id, fund_id, amount")
      .in("budget_id", budgetIds);
    budgetLines = unwrapRows<BudgetLineDetailRow>(
      "getBudgetsData.budgetLines",
      budgetLinesResult,
    ).filter((line) => budgetIdSet.has(line.budget_id));
  }

  const hasActiveBudget = budgets.some((budget) => budget.status === "active");
  const ledgerContext = hasActiveBudget
    ? await loadLedgerBalanceContext(scopedOrganizationId, { asOfDate: today })
    : null;

  const fundNames = new Map(funds.map((fund) => [fund.id, fund.name]));
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const budgetRecords = attachBudgetLines(
    budgets,
    budgetLines,
    fundNames,
    accountNames,
    accounts,
    funds,
    ledgerContext?.lines ?? [],
  );

  return {
    organizationId: scopedOrganizationId,
    budgets: budgetRecords,
    accounts,
    funds,
    budgetVsActual: selectCurrentBudgetVsActual(budgetRecords, today),
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

export async function createBudget(
  organizationId: string,
  input: CreateBudgetInput,
): Promise<BudgetRow> {
  const operation = "createBudget";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const budgetName = requireBudgetName(input.name, operation);
  const { startDate, endDate } = requireBudgetDates(
    input.startDate,
    input.endDate,
    operation,
  );
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_budget", {
    target_organization_id: scopedOrganizationId,
    budget_name: budgetName,
    budget_start_date: startDate,
    budget_end_date: endDate,
    budget_status: input.status ?? "draft",
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createBudget RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Budget creation returned no row",
    });
  }

  return result.data as BudgetRow;
}

export async function upsertBudgetLine(
  organizationId: string,
  input: UpsertBudgetLineInput,
): Promise<BudgetLineRow> {
  const operation = "upsertBudgetLine";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const budgetId = requireBudgetId(input.budgetId, operation);
  const accountId = requireAccountId(input.accountId, operation);
  const amount = requireNonNegativeAmount(input.amount, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("upsert_budget_line", {
    target_organization_id: scopedOrganizationId,
    target_budget_id: budgetId,
    target_account_id: accountId,
    line_amount: amount,
    target_fund_id: input.fundId ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[upsertBudgetLine RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Budget line upsert returned no row",
    });
  }

  return result.data as BudgetLineRow;
}

export async function activateBudget(
  organizationId: string,
  budgetId: string,
): Promise<BudgetRow> {
  const operation = "activateBudget";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedBudgetId = requireBudgetId(budgetId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("activate_budget", {
    target_organization_id: scopedOrganizationId,
    target_budget_id: scopedBudgetId,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[activateBudget RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Budget activation returned no row",
    });
  }

  return result.data as BudgetRow;
}

export async function computeBudgetVsActualForOrganization(
  organizationId: string,
  budgetId?: string,
): Promise<BudgetVsActualReport | null> {
  const data = await getBudgetsData(organizationId);

  if (budgetId) {
    return (
      data.budgets.find((budget) => budget.id === budgetId)?.budgetVsActual ??
      null
    );
  }

  return data.budgetVsActual;
}

export type {
  BudgetLineInput,
  BudgetVsActualReport,
  BudgetVsActualRow,
} from "./ledger-balances";
