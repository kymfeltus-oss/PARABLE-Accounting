/**
 * Ledger balance aggregation from posted journal entry lines.
 *
 * Natural (signed) balance convention:
 * - asset, expense: debit - credit (debits increase the account)
 * - liability, net_asset, revenue: credit - debit (credits increase the account)
 *
 * Only lines from journal entries with status = 'posted' should be supplied.
 * Date filters use journal entry_date (inclusive bounds).
 */

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "net_asset",
  "revenue",
  "expense",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type LedgerLineInput = {
  journalEntryId: string;
  entryDate: string;
  accountId: string;
  accountType: AccountType;
  accountCode: string;
  accountName: string;
  fundId: string | null;
  debitAmount: number;
  creditAmount: number;
};

export type AccountInfo = {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
};

export type FundInfo = {
  id: string;
  name: string;
  code: string | null;
};

export type AccountBalance = AccountInfo & {
  balance: number;
};

export type TrialBalanceRow = AccountInfo & {
  debitBalance: number;
  creditBalance: number;
};

export type TrialBalanceReport = {
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

export type BalanceSheetSection = {
  accountType: "asset" | "liability" | "net_asset";
  rows: AccountBalance[];
  sectionTotal: number;
};

export type BalanceSheetReport = {
  asOfDate: string;
  sections: BalanceSheetSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalNetAssets: number;
  totalLiabilitiesAndNetAssets: number;
};

export type IncomeStatementRow = AccountInfo & {
  accountType: "revenue" | "expense";
  amount: number;
};

export type IncomeStatementReport = {
  startDate: string;
  endDate: string;
  revenue: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export type FundBalanceRow = FundInfo & {
  balance: number;
};

export type FundBalanceReport = {
  asOfDate: string;
  rows: FundBalanceRow[];
  totalBalance: number;
};

const DEBIT_NORMAL_TYPES = new Set<AccountType>(["asset", "expense"]);
const BALANCE_SHEET_TYPES = new Set<AccountType>([
  "asset",
  "liability",
  "net_asset",
]);

export function isDebitNormalAccountType(accountType: AccountType): boolean {
  return DEBIT_NORMAL_TYPES.has(accountType);
}

export function computeNaturalBalance(
  accountType: AccountType,
  debitAmount: number,
  creditAmount: number,
): number {
  if (isDebitNormalAccountType(accountType)) {
    return debitAmount - creditAmount;
  }

  return creditAmount - debitAmount;
}

export function filterLinesAsOf(
  lines: ReadonlyArray<LedgerLineInput>,
  asOfDate: string,
): LedgerLineInput[] {
  return lines.filter((line) => line.entryDate <= asOfDate);
}

export function filterLinesByDateRange(
  lines: ReadonlyArray<LedgerLineInput>,
  startDate: string,
  endDate: string,
): LedgerLineInput[] {
  return lines.filter(
    (line) => line.entryDate >= startDate && line.entryDate <= endDate,
  );
}

export function aggregateAccountBalances(
  lines: ReadonlyArray<LedgerLineInput>,
  accounts: ReadonlyArray<AccountInfo>,
): AccountBalance[] {
  const balanceByAccountId = new Map<string, number>();

  for (const line of lines) {
    const delta = computeNaturalBalance(
      line.accountType,
      line.debitAmount,
      line.creditAmount,
    );
    balanceByAccountId.set(
      line.accountId,
      (balanceByAccountId.get(line.accountId) ?? 0) + delta,
    );
  }

  return accounts
    .map((account) => ({
      ...account,
      balance: balanceByAccountId.get(account.id) ?? 0,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

export function toTrialBalanceRow(balance: AccountBalance): TrialBalanceRow {
  if (balance.balance === 0) {
    return {
      id: balance.id,
      code: balance.code,
      name: balance.name,
      accountType: balance.accountType,
      debitBalance: 0,
      creditBalance: 0,
    };
  }

  if (isDebitNormalAccountType(balance.accountType)) {
    return {
      id: balance.id,
      code: balance.code,
      name: balance.name,
      accountType: balance.accountType,
      debitBalance: balance.balance > 0 ? balance.balance : 0,
      creditBalance: balance.balance < 0 ? Math.abs(balance.balance) : 0,
    };
  }

  return {
    id: balance.id,
    code: balance.code,
    name: balance.name,
    accountType: balance.accountType,
    debitBalance: balance.balance < 0 ? Math.abs(balance.balance) : 0,
    creditBalance: balance.balance > 0 ? balance.balance : 0,
  };
}

export function buildTrialBalance(
  lines: ReadonlyArray<LedgerLineInput>,
  accounts: ReadonlyArray<AccountInfo>,
  asOfDate: string,
): TrialBalanceReport {
  const filteredLines = filterLinesAsOf(lines, asOfDate);
  const accountBalances = aggregateAccountBalances(filteredLines, accounts);
  const rows = accountBalances
    .map(toTrialBalanceRow)
    .filter((row) => row.debitBalance !== 0 || row.creditBalance !== 0);

  const totalDebits = rows.reduce((sum, row) => sum + row.debitBalance, 0);
  const totalCredits = rows.reduce((sum, row) => sum + row.creditBalance, 0);

  return {
    asOfDate,
    rows,
    totalDebits,
    totalCredits,
    isBalanced: totalDebits === totalCredits,
  };
}

function buildBalanceSheetSection(
  accountType: "asset" | "liability" | "net_asset",
  accountBalances: ReadonlyArray<AccountBalance>,
): BalanceSheetSection {
  const rows = accountBalances.filter(
    (balance) =>
      balance.accountType === accountType &&
      BALANCE_SHEET_TYPES.has(balance.accountType) &&
      balance.balance !== 0,
  );

  return {
    accountType,
    rows,
    sectionTotal: rows.reduce((sum, row) => sum + row.balance, 0),
  };
}

export function buildBalanceSheet(
  lines: ReadonlyArray<LedgerLineInput>,
  accounts: ReadonlyArray<AccountInfo>,
  asOfDate: string,
): BalanceSheetReport {
  const filteredLines = filterLinesAsOf(lines, asOfDate);
  const accountBalances = aggregateAccountBalances(filteredLines, accounts);

  const sections: BalanceSheetSection[] = [
    buildBalanceSheetSection("asset", accountBalances),
    buildBalanceSheetSection("liability", accountBalances),
    buildBalanceSheetSection("net_asset", accountBalances),
  ];

  const totalAssets = sections[0]?.sectionTotal ?? 0;
  const totalLiabilities = sections[1]?.sectionTotal ?? 0;
  const totalNetAssets = sections[2]?.sectionTotal ?? 0;

  return {
    asOfDate,
    sections,
    totalAssets,
    totalLiabilities,
    totalNetAssets,
    totalLiabilitiesAndNetAssets: totalLiabilities + totalNetAssets,
  };
}

export function buildIncomeStatement(
  lines: ReadonlyArray<LedgerLineInput>,
  accounts: ReadonlyArray<AccountInfo>,
  startDate: string,
  endDate: string,
): IncomeStatementReport {
  const filteredLines = filterLinesByDateRange(lines, startDate, endDate);
  const accountBalances = aggregateAccountBalances(filteredLines, accounts);

  const revenue = accountBalances
    .filter((balance) => balance.accountType === "revenue" && balance.balance !== 0)
    .map((balance) => ({
      ...balance,
      accountType: "revenue" as const,
      amount: balance.balance,
    }));

  const expenses = accountBalances
    .filter((balance) => balance.accountType === "expense" && balance.balance !== 0)
    .map((balance) => ({
      ...balance,
      accountType: "expense" as const,
      amount: balance.balance,
    }));

  const totalRevenue = revenue.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + row.amount, 0);

  return {
    startDate,
    endDate,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

export function buildFundBalanceReport(
  lines: ReadonlyArray<LedgerLineInput>,
  funds: ReadonlyArray<FundInfo>,
  asOfDate: string,
): FundBalanceReport {
  const filteredLines = filterLinesAsOf(lines, asOfDate).filter(
    (line) => line.fundId !== null,
  );

  const balanceByFundId = new Map<string, number>();

  for (const line of filteredLines) {
    if (!line.fundId) {
      continue;
    }

    const signedAmount = line.creditAmount - line.debitAmount;
    balanceByFundId.set(
      line.fundId,
      (balanceByFundId.get(line.fundId) ?? 0) + signedAmount,
    );
  }

  const rows = funds
    .map((fund) => ({
      ...fund,
      balance: balanceByFundId.get(fund.id) ?? 0,
    }))
    .filter((row) => row.balance !== 0)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    asOfDate,
    rows,
    totalBalance: rows.reduce((sum, row) => sum + row.balance, 0),
  };
}

export function buildAccountBalanceMap(
  lines: ReadonlyArray<LedgerLineInput>,
  accounts: ReadonlyArray<AccountInfo>,
  asOfDate: string,
): Map<string, number> {
  const filteredLines = filterLinesAsOf(lines, asOfDate);
  const balances = aggregateAccountBalances(filteredLines, accounts);

  return new Map(balances.map((balance) => [balance.id, balance.balance]));
}

export function buildFundBalanceMap(
  lines: ReadonlyArray<LedgerLineInput>,
  asOfDate: string,
): Map<string, number> {
  const filteredLines = filterLinesAsOf(lines, asOfDate).filter(
    (line) => line.fundId !== null,
  );
  const balanceByFundId = new Map<string, number>();

  for (const line of filteredLines) {
    if (!line.fundId) {
      continue;
    }

    const signedAmount = line.creditAmount - line.debitAmount;
    balanceByFundId.set(
      line.fundId,
      (balanceByFundId.get(line.fundId) ?? 0) + signedAmount,
    );
  }

  return balanceByFundId;
}

export type BudgetLineInput = {
  accountId: string;
  accountType: "revenue" | "expense";
  accountCode: string;
  accountName: string;
  fundId: string | null;
  fundName: string | null;
  budgetedAmount: number;
};

export type BudgetVsActualRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: "revenue" | "expense";
  fundId: string | null;
  fundName: string | null;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
};

export type BudgetVsActualReport = {
  budgetId: string;
  budgetName: string;
  startDate: string;
  endDate: string;
  rows: BudgetVsActualRow[];
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
};

function computeBudgetLineActualAmount(
  lines: ReadonlyArray<LedgerLineInput>,
  budgetLine: BudgetLineInput,
  startDate: string,
  endDate: string,
): number {
  const filteredLines = filterLinesByDateRange(lines, startDate, endDate).filter(
    (line) =>
      line.accountId === budgetLine.accountId &&
      (budgetLine.fundId === null || line.fundId === budgetLine.fundId),
  );

  let actualAmount = 0;

  for (const line of filteredLines) {
    actualAmount += computeNaturalBalance(
      line.accountType,
      line.debitAmount,
      line.creditAmount,
    );
  }

  return actualAmount;
}

function computeBudgetVariance(
  accountType: "revenue" | "expense",
  budgetedAmount: number,
  actualAmount: number,
): number {
  if (accountType === "expense") {
    return budgetedAmount - actualAmount;
  }

  return actualAmount - budgetedAmount;
}

export function buildBudgetVsActualReport(
  budget: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  },
  budgetLines: ReadonlyArray<BudgetLineInput>,
  ledgerLines: ReadonlyArray<LedgerLineInput>,
): BudgetVsActualReport {
  const rows = budgetLines.map((budgetLine) => {
    const actualAmount = computeBudgetLineActualAmount(
      ledgerLines,
      budgetLine,
      budget.startDate,
      budget.endDate,
    );

    return {
      accountId: budgetLine.accountId,
      accountCode: budgetLine.accountCode,
      accountName: budgetLine.accountName,
      accountType: budgetLine.accountType,
      fundId: budgetLine.fundId,
      fundName: budgetLine.fundName,
      budgetedAmount: budgetLine.budgetedAmount,
      actualAmount,
      variance: computeBudgetVariance(
        budgetLine.accountType,
        budgetLine.budgetedAmount,
        actualAmount,
      ),
    };
  });

  const totalBudgeted = rows.reduce((sum, row) => sum + row.budgetedAmount, 0);
  const totalActual = rows.reduce((sum, row) => sum + row.actualAmount, 0);
  const totalVariance = rows.reduce((sum, row) => sum + row.variance, 0);

  return {
    budgetId: budget.id,
    budgetName: budget.name,
    startDate: budget.startDate,
    endDate: budget.endDate,
    rows,
    totalBudgeted,
    totalActual,
    totalVariance,
  };
}
