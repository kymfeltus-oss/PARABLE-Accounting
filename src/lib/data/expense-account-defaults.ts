export type ExpenseAccountDefaultOption = {
  id: string;
  code: string;
};

export function resolveDefaultExpenseAccountId(
  accountOptions: ExpenseAccountDefaultOption[],
): string | null {
  if (accountOptions.length === 0) {
    return null;
  }

  for (const code of ["5000", "6000"]) {
    const match = accountOptions.find((account) => account.code === code);
    if (match) {
      return match.id;
    }
  }

  return accountOptions[0]?.id ?? null;
}

export function resolveDefaultExpenseCreditAccountId(
  creditAccounts: ExpenseAccountDefaultOption[],
  paymentSource: string | null,
  defaultCashAccountId?: string | null,
): string | null {
  if (creditAccounts.length === 0) {
    return null;
  }

  const source = paymentSource?.trim().toLowerCase() ?? "";

  if (
    (source === "bank" || source === "cash") &&
    defaultCashAccountId &&
    creditAccounts.some((account) => account.id === defaultCashAccountId)
  ) {
    return defaultCashAccountId;
  }

  const preferredCodes =
    source === "bank" || source === "cash"
      ? ["1000", "1010"]
      : source === "card" || source === "reimbursement"
        ? ["2100", "2000"]
        : [];

  for (const code of preferredCodes) {
    const match = creditAccounts.find((account) => account.code === code);
    if (match) {
      return match.id;
    }
  }

  return creditAccounts[0]?.id ?? null;
}
