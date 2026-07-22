import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { getMonthDateRange, sumAmounts, unwrapRows } from "./query-helpers";
import type { ExpenseRow, VendorRow } from "./types/rows";

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
