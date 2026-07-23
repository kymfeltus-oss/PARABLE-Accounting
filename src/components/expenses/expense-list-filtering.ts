import type { ExpenseRecord } from "@/lib/data/expenses-repository";

export const expenseStatusFilters = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "recorded", label: "Recorded" },
] as const;

export type ExpenseStatusFilterId =
  (typeof expenseStatusFilters)[number]["id"];

export type ExpenseStatusCounts = {
  all: number;
  draft: number;
  recorded: number;
};

export function isActiveExpense(expense: ExpenseRecord): boolean {
  return expense.status !== "void";
}

export function sortActiveExpenses(expenses: ExpenseRecord[]): ExpenseRecord[] {
  return expenses
    .filter(isActiveExpense)
    .sort((left, right) => {
      const dateComparison = right.expense_date.localeCompare(left.expense_date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return right.created_at.localeCompare(left.created_at);
    });
}

export function getExpenseStatusCounts(
  expenses: ExpenseRecord[],
): ExpenseStatusCounts {
  const activeExpenses = expenses.filter(isActiveExpense);

  return {
    all: activeExpenses.length,
    draft: activeExpenses.filter((expense) => expense.status === "draft").length,
    recorded: activeExpenses.filter((expense) => expense.status === "recorded")
      .length,
  };
}

export function expenseMatchesStatusFilter(
  expense: ExpenseRecord,
  statusFilter: ExpenseStatusFilterId,
): boolean {
  if (statusFilter === "all") {
    return true;
  }

  return expense.status === statusFilter;
}

export function expenseMatchesSearch(
  expense: ExpenseRecord,
  searchQuery: string,
): boolean {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const haystack = [
    expense.description,
    expense.reference ?? "",
    expense.vendorName ?? "",
    expense.payment_source,
    formatPaymentSourceForSearch(expense.payment_source),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function formatPaymentSourceForSearch(source: string): string {
  return source.replace(/_/g, " ");
}

export function filterExpenses(
  expenses: ExpenseRecord[],
  statusFilter: ExpenseStatusFilterId,
  searchQuery: string,
): ExpenseRecord[] {
  return sortActiveExpenses(expenses).filter(
    (expense) =>
      expenseMatchesStatusFilter(expense, statusFilter) &&
      expenseMatchesSearch(expense, searchQuery),
  );
}

export function countDraftsNeedingAllocation(expenses: ExpenseRecord[]): number {
  return expenses.filter(
    (expense) => expense.status === "draft" && expense.lineCount === 0,
  ).length;
}
