import type { FinancialReports } from "@/lib/data/ledger-balances-repository";

export function createEmptyFinancialReports(
  asOfDate = "2026-07-24",
  periodStartDate = "2026-01-01",
  periodEndDate = asOfDate,
): FinancialReports {
  return {
    asOfDate,
    periodStartDate,
    periodEndDate,
    trialBalance: {
      asOfDate,
      rows: [],
      totalDebits: 0,
      totalCredits: 0,
      isBalanced: true,
    },
    balanceSheet: {
      asOfDate,
      sections: [
        { accountType: "asset", rows: [], sectionTotal: 0 },
        { accountType: "liability", rows: [], sectionTotal: 0 },
        { accountType: "net_asset", rows: [], sectionTotal: 0 },
      ],
      totalAssets: 0,
      totalLiabilities: 0,
      totalNetAssets: 0,
      totalLiabilitiesAndNetAssets: 0,
      unclosedChangeInNetAssets: 0,
      isEquationBalanced: true,
    },
    incomeStatement: {
      startDate: periodStartDate,
      endDate: periodEndDate,
      revenue: [],
      expenses: [],
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
    },
    fundBalance: {
      asOfDate,
      rows: [],
      totalBalance: 0,
    },
  };
}

export function createPopulatedFinancialReports(): FinancialReports {
  return {
    asOfDate: "2026-07-24",
    periodStartDate: "2026-01-01",
    periodEndDate: "2026-07-24",
    trialBalance: {
      asOfDate: "2026-07-24",
      rows: [
        {
          id: "account-cash",
          code: "1000",
          name: "Operating Cash",
          accountType: "asset",
          debitBalance: 850,
          creditBalance: 0,
        },
        {
          id: "account-revenue",
          code: "4000",
          name: "Donations",
          accountType: "revenue",
          debitBalance: 0,
          creditBalance: 1000,
        },
        {
          id: "account-expense",
          code: "5100",
          name: "Office Expense",
          accountType: "expense",
          debitBalance: 150,
          creditBalance: 0,
        },
      ],
      totalDebits: 1000,
      totalCredits: 1000,
      isBalanced: true,
    },
    balanceSheet: {
      asOfDate: "2026-07-24",
      sections: [
        {
          accountType: "asset",
          rows: [
            {
              id: "account-cash",
              code: "1000",
              name: "Operating Cash",
              accountType: "asset",
              balance: 850,
            },
          ],
          sectionTotal: 850,
        },
        {
          accountType: "liability",
          rows: [],
          sectionTotal: 0,
        },
        {
          accountType: "net_asset",
          rows: [
            {
              id: "account-net",
              code: "3000",
              name: "Net Assets",
              accountType: "net_asset",
              balance: 850,
            },
          ],
          sectionTotal: 850,
        },
      ],
      totalAssets: 850,
      totalLiabilities: 0,
      totalNetAssets: 850,
      totalLiabilitiesAndNetAssets: 850,
      unclosedChangeInNetAssets: 0,
      isEquationBalanced: true,
    },
    incomeStatement: {
      startDate: "2026-01-01",
      endDate: "2026-07-24",
      revenue: [
        {
          id: "account-revenue",
          code: "4000",
          name: "Donations",
          accountType: "revenue",
          amount: 1000,
        },
      ],
      expenses: [
        {
          id: "account-expense",
          code: "5100",
          name: "Office Expense",
          accountType: "expense",
          amount: 150,
        },
      ],
      totalRevenue: 1000,
      totalExpenses: 150,
      netIncome: 850,
    },
    fundBalance: {
      asOfDate: "2026-07-24",
      rows: [
        {
          id: "fund-1",
          name: "General Fund",
          code: "GEN",
          balance: 850,
        },
      ],
      totalBalance: 850,
    },
  };
}
