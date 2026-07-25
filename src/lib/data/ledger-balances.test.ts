import { describe, expect, it } from "vitest";

import type { AccountInfo, LedgerLineInput } from "./ledger-balances";
import {
  aggregateAccountBalances,
  buildBalanceSheet,
  buildBudgetVsActualReport,
  buildFundBalanceReport,
  buildIncomeStatement,
  buildTrialBalance,
  computeNaturalBalance,
  filterLinesAsOf,
  filterLinesByDateRange,
} from "./ledger-balances";

const accounts: AccountInfo[] = [
  {
    id: "cash",
    code: "1000",
    name: "Cash",
    accountType: "asset",
  },
  {
    id: "payable",
    code: "2000",
    name: "Accounts Payable",
    accountType: "liability",
  },
  {
    id: "net-assets",
    code: "3000",
    name: "Net Assets Without Restrictions",
    accountType: "net_asset",
  },
  {
    id: "donations",
    code: "4000",
    name: "Donations",
    accountType: "revenue",
  },
  {
    id: "utilities",
    code: "5100",
    name: "Utilities",
    accountType: "expense",
  },
];

function createLine(
  overrides: Partial<LedgerLineInput> & Pick<LedgerLineInput, "journalEntryId" | "entryDate" | "accountId" | "accountType" | "debitAmount" | "creditAmount">,
): LedgerLineInput {
  const account = accounts.find((entry) => entry.id === overrides.accountId);

  return {
    accountCode: account?.code ?? "0000",
    accountName: account?.name ?? "Unknown",
    fundId: null,
    ...overrides,
  };
}

describe("computeNaturalBalance", () => {
  it("treats debits as increasing asset and expense accounts", () => {
    expect(computeNaturalBalance("asset", 100, 0)).toBe(100);
    expect(computeNaturalBalance("asset", 100, 25)).toBe(75);
    expect(computeNaturalBalance("expense", 50, 0)).toBe(50);
  });

  it("treats credits as increasing liability, net_asset, and revenue accounts", () => {
    expect(computeNaturalBalance("liability", 0, 200)).toBe(200);
    expect(computeNaturalBalance("net_asset", 0, 500)).toBe(500);
    expect(computeNaturalBalance("revenue", 0, 150)).toBe(150);
  });
});

describe("filterLinesAsOf and filterLinesByDateRange", () => {
  const lines: LedgerLineInput[] = [
    createLine({
      journalEntryId: "je-1",
      entryDate: "2026-06-15",
      accountId: "cash",
      accountType: "asset",
      debitAmount: 100,
      creditAmount: 0,
    }),
    createLine({
      journalEntryId: "je-2",
      entryDate: "2026-07-10",
      accountId: "donations",
      accountType: "revenue",
      debitAmount: 0,
      creditAmount: 100,
    }),
    createLine({
      journalEntryId: "je-3",
      entryDate: "2026-08-01",
      accountId: "utilities",
      accountType: "expense",
      debitAmount: 40,
      creditAmount: 0,
    }),
  ];

  it("includes only lines on or before the as-of date", () => {
    expect(filterLinesAsOf(lines, "2026-07-31")).toHaveLength(2);
    expect(filterLinesAsOf(lines, "2026-06-15")).toHaveLength(1);
  });

  it("includes only lines within the income statement period", () => {
    expect(filterLinesByDateRange(lines, "2026-07-01", "2026-07-31")).toHaveLength(1);
    expect(filterLinesByDateRange(lines, "2026-01-01", "2026-12-31")).toHaveLength(3);
  });
});

describe("aggregateAccountBalances", () => {
  it("excludes non-posted activity when only posted lines are supplied", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "posted-1",
        entryDate: "2026-07-01",
        accountId: "cash",
        accountType: "asset",
        debitAmount: 500,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "posted-1",
        entryDate: "2026-07-01",
        accountId: "donations",
        accountType: "revenue",
        debitAmount: 0,
        creditAmount: 500,
      }),
    ];

    const balances = aggregateAccountBalances(lines, accounts);

    expect(balances.find((row) => row.id === "cash")?.balance).toBe(500);
    expect(balances.find((row) => row.id === "donations")?.balance).toBe(500);
  });

  it("aggregates debit-normal and credit-normal accounts independently", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "cash",
        accountType: "asset",
        debitAmount: 300,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "payable",
        accountType: "liability",
        debitAmount: 0,
        creditAmount: 300,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-07-15",
        accountId: "utilities",
        accountType: "expense",
        debitAmount: 75,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-07-15",
        accountId: "cash",
        accountType: "asset",
        debitAmount: 0,
        creditAmount: 75,
      }),
    ];

    const balances = aggregateAccountBalances(lines, accounts);

    expect(balances.find((row) => row.id === "cash")?.balance).toBe(225);
    expect(balances.find((row) => row.id === "payable")?.balance).toBe(300);
    expect(balances.find((row) => row.id === "utilities")?.balance).toBe(75);
  });
});

describe("buildTrialBalance", () => {
  it("places natural balances into debit and credit columns", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "cash",
        accountType: "asset",
        debitAmount: 100,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "donations",
        accountType: "revenue",
        debitAmount: 0,
        creditAmount: 100,
      }),
    ];

    const report = buildTrialBalance(lines, accounts, "2026-07-31");

    expect(report.rows).toEqual([
      expect.objectContaining({
        id: "cash",
        debitBalance: 100,
        creditBalance: 0,
      }),
      expect.objectContaining({
        id: "donations",
        debitBalance: 0,
        creditBalance: 100,
      }),
    ]);
    expect(report.totalDebits).toBe(100);
    expect(report.totalCredits).toBe(100);
    expect(report.isBalanced).toBe(true);
  });
});

describe("buildBalanceSheet", () => {
  it("includes only asset, liability, and net_asset accounts through as-of date", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "cash",
        accountType: "asset",
        debitAmount: 1000,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "payable",
        accountType: "liability",
        debitAmount: 0,
        creditAmount: 200,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "net-assets",
        accountType: "net_asset",
        debitAmount: 0,
        creditAmount: 800,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-08-01",
        accountId: "cash",
        accountType: "asset",
        debitAmount: 50,
        creditAmount: 0,
      }),
    ];

    const report = buildBalanceSheet(lines, accounts, "2026-07-31");

    expect(report.totalAssets).toBe(1000);
    expect(report.totalLiabilities).toBe(200);
    expect(report.totalNetAssets).toBe(800);
    expect(report.totalLiabilitiesAndNetAssets).toBe(1000);
  });
});

describe("buildIncomeStatement", () => {
  it("aggregates revenue and expense activity within the period", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-06-30",
        accountId: "donations",
        accountType: "revenue",
        debitAmount: 0,
        creditAmount: 500,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-07-10",
        accountId: "donations",
        accountType: "revenue",
        debitAmount: 0,
        creditAmount: 300,
      }),
      createLine({
        journalEntryId: "je-3",
        entryDate: "2026-07-20",
        accountId: "utilities",
        accountType: "expense",
        debitAmount: 120,
        creditAmount: 0,
      }),
    ];

    const report = buildIncomeStatement(lines, accounts, "2026-07-01", "2026-07-31");

    expect(report.totalRevenue).toBe(300);
    expect(report.totalExpenses).toBe(120);
    expect(report.netIncome).toBe(180);
  });
});

describe("buildFundBalanceReport", () => {
  it("uses balance-sheet natural balances so dual-tagged giving does not cancel to zero", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "cash",
        accountType: "asset",
        fundId: "fund-a",
        debitAmount: 500,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "donations",
        accountType: "revenue",
        fundId: "fund-a",
        debitAmount: 0,
        creditAmount: 500,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-08-01",
        accountId: "cash",
        accountType: "asset",
        fundId: "fund-b",
        debitAmount: 100,
        creditAmount: 0,
      }),
    ];

    const report = buildFundBalanceReport(
      lines,
      [
        { id: "fund-a", name: "General Fund", code: "GEN" },
        { id: "fund-b", name: "Building Fund", code: "BLD" },
      ],
      "2026-07-31",
    );

    expect(report.rows).toEqual([
      expect.objectContaining({ id: "fund-a", balance: 500 }),
    ]);
    expect(report.totalBalance).toBe(500);
  });

  it("decreases fund balance when dual-tagged expenses spend cash", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "cash",
        accountType: "asset",
        fundId: "fund-a",
        debitAmount: 500,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "donations",
        accountType: "revenue",
        fundId: "fund-a",
        debitAmount: 0,
        creditAmount: 500,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-07-15",
        accountId: "utilities",
        accountType: "expense",
        fundId: "fund-a",
        debitAmount: 120,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-07-15",
        accountId: "cash",
        accountType: "asset",
        fundId: "fund-a",
        debitAmount: 0,
        creditAmount: 120,
      }),
    ];

    const report = buildFundBalanceReport(
      lines,
      [{ id: "fund-a", name: "General Fund", code: "GEN" }],
      "2026-07-31",
    );

    expect(report.rows).toEqual([
      expect.objectContaining({ id: "fund-a", balance: 380 }),
    ]);
    expect(report.totalBalance).toBe(380);
  });

  it("subtracts liabilities from fund equity", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "expense",
        accountType: "expense",
        fundId: "fund-a",
        debitAmount: 200,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-07-01",
        accountId: "ap",
        accountType: "liability",
        fundId: "fund-a",
        debitAmount: 0,
        creditAmount: 200,
      }),
    ];

    const report = buildFundBalanceReport(
      lines,
      [{ id: "fund-a", name: "General Fund", code: "GEN" }],
      "2026-07-31",
    );

    expect(report.rows).toEqual([
      expect.objectContaining({ id: "fund-a", balance: -200 }),
    ]);
  });
});

describe("buildBudgetVsActualReport", () => {
  it("compares expense budget lines to posted ledger activity in the budget period", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-03-01",
        accountId: "utilities",
        accountType: "expense",
        fundId: "fund-a",
        debitAmount: 150,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2027-01-01",
        accountId: "utilities",
        accountType: "expense",
        fundId: "fund-a",
        debitAmount: 999,
        creditAmount: 0,
      }),
    ];

    const report = buildBudgetVsActualReport(
      {
        id: "budget-1",
        name: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      [
        {
          accountId: "utilities",
          accountType: "expense",
          accountCode: "5100",
          accountName: "Utilities",
          fundId: "fund-a",
          fundName: "General Fund",
          budgetedAmount: 1000,
        },
      ],
      lines,
    );

    expect(report.rows[0]).toMatchObject({
      budgetedAmount: 1000,
      actualAmount: 150,
      variance: 850,
    });
    expect(report.totalBudgeted).toBe(1000);
    expect(report.totalActual).toBe(150);
    expect(report.totalVariance).toBe(850);
  });

  it("filters actuals by fund when a budget line specifies a fund", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-03-01",
        accountId: "utilities",
        accountType: "expense",
        fundId: "fund-a",
        debitAmount: 100,
        creditAmount: 0,
      }),
      createLine({
        journalEntryId: "je-2",
        entryDate: "2026-03-02",
        accountId: "utilities",
        accountType: "expense",
        fundId: "fund-b",
        debitAmount: 50,
        creditAmount: 0,
      }),
    ];

    const report = buildBudgetVsActualReport(
      {
        id: "budget-1",
        name: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      [
        {
          accountId: "utilities",
          accountType: "expense",
          accountCode: "5100",
          accountName: "Utilities",
          fundId: "fund-a",
          fundName: "General Fund",
          budgetedAmount: 500,
        },
      ],
      lines,
    );

    expect(report.rows[0]?.actualAmount).toBe(100);
  });

  it("uses revenue-favorable variance semantics for revenue accounts", () => {
    const lines: LedgerLineInput[] = [
      createLine({
        journalEntryId: "je-1",
        entryDate: "2026-04-01",
        accountId: "donations",
        accountType: "revenue",
        fundId: null,
        debitAmount: 0,
        creditAmount: 6000,
      }),
    ];

    const report = buildBudgetVsActualReport(
      {
        id: "budget-1",
        name: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      [
        {
          accountId: "donations",
          accountType: "revenue",
          accountCode: "4000",
          accountName: "Donations",
          fundId: null,
          fundName: null,
          budgetedAmount: 5000,
        },
      ],
      lines,
    );

    expect(report.rows[0]).toMatchObject({
      actualAmount: 6000,
      variance: 1000,
    });
  });
});
