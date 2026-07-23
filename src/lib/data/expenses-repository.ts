import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { getMonthDateRange, sumAmounts, toDataAccessError, unwrapRows } from "./query-helpers";
import type { ExpenseLineRow, ExpenseRow, VendorRow } from "./types/rows";

export type ExpenseRecord = ExpenseRow & {
  vendorName: string | null;
  lineCount: number;
};

export type ExpensesData = {
  organizationId: string;
  expenses: ExpenseRecord[];
  counts: {
    total: number;
    thisMonth: number;
  };
  summary: {
    totalAmount: number;
    amountThisMonth: number;
  };
};

export type ExpensePaymentSource =
  | "bank"
  | "card"
  | "cash"
  | "reimbursement"
  | "other";

export type CreateExpenseDraftInput = {
  expenseDate: string;
  description: string;
  totalAmount: number;
  vendorId?: string | null;
  reference?: string | null;
  paymentSource: ExpensePaymentSource;
};

export type ReplaceExpenseDraftLineInput = {
  accountId: string;
  fundId?: string | null;
  amount: number;
  description?: string | null;
};

export type ReplaceExpenseDraftLinesInput = {
  expenseId: string;
  lines: ReplaceExpenseDraftLineInput[];
};

export type ExpenseDraftLineDetail = {
  id: string;
  expenseId: string;
  accountId: string;
  fundId: string | null;
  lineNumber: number;
  description: string | null;
  amount: number;
};

function requireExpenseId(expenseId: string, operation: string): string {
  const trimmed = expenseId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "expenseId is required and must be a non-empty string",
    });
  }

  return trimmed;
}

function toExpenseDraftLineDetail(line: ExpenseLineRow): ExpenseDraftLineDetail {
  return {
    id: line.id,
    expenseId: line.expense_id,
    accountId: line.account_id,
    fundId: line.fund_id,
    lineNumber: line.line_number,
    description: line.description,
    amount: Number(line.amount),
  };
}

function isActiveExpense(expense: ExpenseRow): boolean {
  return expense.status !== "void";
}

function isExpenseInCurrentMonth(
  expense: ExpenseRow,
  startDate: string,
  endDate: string,
): boolean {
  return (
    expense.expense_date >= startDate && expense.expense_date <= endDate
  );
}

function attachExpenseMetadata(
  expenses: ExpenseRow[],
  vendors: VendorRow[],
  lineCounts: Map<string, number>,
): ExpenseRecord[] {
  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));

  return expenses.map((expense) => ({
    ...expense,
    vendorName: expense.vendor_id
      ? (vendorNames.get(expense.vendor_id) ?? null)
      : null,
    lineCount: lineCounts.get(expense.id) ?? 0,
  }));
}

function countLinesByExpenseId(
  lines: ReadonlyArray<{ expense_id: string }>,
): Map<string, number> {
  const lineCounts = new Map<string, number>();

  for (const line of lines) {
    lineCounts.set(line.expense_id, (lineCounts.get(line.expense_id) ?? 0) + 1);
  }

  return lineCounts;
}

export async function getExpensesData(
  organizationId: string,
): Promise<ExpensesData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getExpensesData",
  );
  const supabase = await createServerSupabaseClient();
  const { startDate, endDate } = getMonthDateRange();

  const [expensesResult, vendorsResult] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("expense_date", { ascending: false }),
    supabase
      .from("vendors")
      .select("*")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const expenses = unwrapRows<ExpenseRow>(
    "getExpensesData.expenses",
    expensesResult,
  );
  const vendors = unwrapRows<VendorRow>(
    "getExpensesData.vendors",
    vendorsResult,
  );
  const activeExpenses = expenses.filter(isActiveExpense);
  const thisMonthExpenses = activeExpenses.filter((expense) =>
    isExpenseInCurrentMonth(expense, startDate, endDate),
  );

  const expenseIds = expenses.map((expense) => expense.id);
  let lineCounts = new Map<string, number>();

  if (expenseIds.length > 0) {
    const linesResult = await supabase
      .from("expense_lines")
      .select("expense_id")
      .in("expense_id", expenseIds);
    const lines = unwrapRows<{ expense_id: string }>(
      "getExpensesData.expenseLines",
      linesResult,
    );
    lineCounts = countLinesByExpenseId(lines);
  }

  return {
    organizationId: scopedOrganizationId,
    expenses: attachExpenseMetadata(expenses, vendors, lineCounts),
    counts: {
      total: activeExpenses.length,
      thisMonth: thisMonthExpenses.length,
    },
    summary: {
      totalAmount: sumAmounts(
        activeExpenses.map((expense) => ({ amount: expense.total_amount })),
      ),
      amountThisMonth: sumAmounts(
        thisMonthExpenses.map((expense) => ({ amount: expense.total_amount })),
      ),
    },
  };
}

export async function createExpenseDraft(
  organizationId: string,
  input: CreateExpenseDraftInput,
): Promise<ExpenseRow> {
  const operation = "createExpenseDraft";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_expense_draft", {
    target_organization_id: scopedOrganizationId,
    input_expense_date: input.expenseDate,
    input_description: input.description,
    input_total_amount: input.totalAmount,
    input_vendor_id: input.vendorId ?? null,
    input_reference: input.reference ?? null,
    input_payment_source: input.paymentSource,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createExpenseDraft RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        organizationId: scopedOrganizationId,
        expenseDate: input.expenseDate,
        hasVendorId: input.vendorId != null,
        paymentSource: input.paymentSource,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Expense draft creation returned no row",
    });
  }

  return result.data as ExpenseRow;
}

export async function replaceExpenseDraftLines(
  organizationId: string,
  input: ReplaceExpenseDraftLinesInput,
): Promise<ExpenseRow> {
  const operation = "replaceExpenseDraftLines";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("replace_expense_draft_lines", {
    target_organization_id: scopedOrganizationId,
    target_expense_id: input.expenseId,
    input_lines: input.lines.map((line) => ({
      account_id: line.accountId,
      fund_id: line.fundId ?? null,
      amount: line.amount,
      description:
        line.description === undefined ? null : line.description,
    })),
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[replaceExpenseDraftLines RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        organizationId: scopedOrganizationId,
        expenseId: input.expenseId,
        lineCount: input.lines.length,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Expense draft line replacement returned no row",
    });
  }

  return result.data as ExpenseRow;
}

async function fetchExpenseLinesForOrganizationExpense(
  scopedOrganizationId: string,
  scopedExpenseId: string,
  operation: string,
): Promise<ExpenseDraftLineDetail[]> {
  const supabase = await createServerSupabaseClient();

  const expenseResult = await supabase
    .from("expenses")
    .select("id")
    .eq("id", scopedExpenseId)
    .eq("organization_id", scopedOrganizationId);

  const matchingExpenses = unwrapRows<{ id: string }>(
    `${operation}.expense`,
    expenseResult,
  );

  if (matchingExpenses.length === 0) {
    throw new DataAccessError({
      operation,
      message: "Expense not found for organization",
    });
  }

  const linesResult = await supabase
    .from("expense_lines")
    .select("*")
    .eq("expense_id", scopedExpenseId)
    .order("line_number", { ascending: true });

  const lines = unwrapRows<ExpenseLineRow>(`${operation}.lines`, linesResult);

  return lines.map(toExpenseDraftLineDetail);
}

export async function getExpenseById(
  organizationId: string,
  expenseId: string,
): Promise<ExpenseRecord | null> {
  const operation = "getExpenseById";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedExpenseId = requireExpenseId(expenseId, operation);
  const supabase = await createServerSupabaseClient();

  const expenseResult = await supabase
    .from("expenses")
    .select("*")
    .eq("id", scopedExpenseId)
    .eq("organization_id", scopedOrganizationId);

  const expenses = unwrapRows<ExpenseRow>(`${operation}.expense`, expenseResult);

  if (expenses.length === 0) {
    return null;
  }

  const expense = expenses[0];
  let vendorName: string | null = null;

  if (expense.vendor_id) {
    const vendorResult = await supabase
      .from("vendors")
      .select("name")
      .eq("id", expense.vendor_id)
      .eq("organization_id", scopedOrganizationId);

    const vendors = unwrapRows<{ name: string }>(
      `${operation}.vendor`,
      vendorResult,
    );
    vendorName = vendors[0]?.name ?? null;
  }

  const linesResult = await supabase
    .from("expense_lines")
    .select("expense_id")
    .eq("expense_id", scopedExpenseId);

  const lines = unwrapRows<{ expense_id: string }>(
    `${operation}.expenseLines`,
    linesResult,
  );

  return {
    ...expense,
    vendorName,
    lineCount: lines.length,
  };
}

export async function getExpenseLines(
  organizationId: string,
  expenseId: string,
): Promise<ExpenseDraftLineDetail[]> {
  const operation = "getExpenseLines";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedExpenseId = requireExpenseId(expenseId, operation);

  return fetchExpenseLinesForOrganizationExpense(
    scopedOrganizationId,
    scopedExpenseId,
    operation,
  );
}

export async function getExpenseDraftLines(
  organizationId: string,
  expenseId: string,
): Promise<ExpenseDraftLineDetail[]> {
  const operation = "getExpenseDraftLines";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedExpenseId = requireExpenseId(expenseId, operation);

  return fetchExpenseLinesForOrganizationExpense(
    scopedOrganizationId,
    scopedExpenseId,
    operation,
  );
}
