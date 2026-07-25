import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { navItems } from "@/config/navigation";
import type { NavItemId } from "@/config/navigation";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: vi.fn(async () => "22222222-2222-4222-8222-222222222222"),
}));

vi.mock("@/lib/data/dashboard-repository", () => ({
  getDashboardData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    openExceptions: [],
    complianceItems: [],
    openBills: [],
    closeTasks: [],
    recentActivity: [],
    summary: {
      totalCash: null,
      givingThisMonth: 0,
      expensesThisMonth: 0,
      netOperatingPosition: 0,
      openBillCount: 0,
      unreconciledTransactionCount: 0,
    },
  })),
}));

vi.mock("@/lib/data/giving-repository", () => ({
  getGivingData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    transactions: [],
    funds: [],
    summary: {
      givingThisMonth: 0,
      yearToDateGiving: 0,
      transactionCount: 0,
      activeGiverCount: 0,
    },
  })),
}));

vi.mock("@/lib/data/members-repository", () => ({
  getMembersData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    members: [],
    counts: {
      total: 0,
      active: 0,
      inactive: 0,
    },
  })),
}));

vi.mock("@/lib/data/banking-repository", () => ({
  getBankingData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    accounts: [],
    transactions: [],
    counts: {
      accountCount: 0,
      transactionCount: 0,
      unmatchedTransactionCount: 0,
    },
  })),
}));

vi.mock("@/lib/data/transactions-repository", () => ({
  getTransactionsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    transactions: [],
    matches: [],
    counts: {
      total: 0,
      unmatched: 0,
      matched: 0,
      excluded: 0,
    },
  })),
}));

vi.mock("@/lib/data/bills-repository", () => ({
  getBillsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    bills: [],
    counts: {
      total: 0,
      open: 0,
      paid: 0,
      overdue: 0,
    },
    summary: {
      openAmount: 0,
    },
  })),
}));

vi.mock("@/lib/data/expenses-repository", () => ({
  getExpensesData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    expenses: [],
    counts: {
      total: 0,
      thisMonth: 0,
    },
    summary: {
      totalAmount: 0,
      amountThisMonth: 0,
    },
  })),
}));

vi.mock("@/lib/data/vendors-repository", () => ({
  getVendorsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    vendors: [],
    counts: {
      total: 0,
      active: 0,
      inactive: 0,
      withBills: 0,
      withExpenses: 0,
    },
  })),
}));

vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    funds: [],
    counts: {
      total: 0,
      withGiving: 0,
      withExpenses: 0,
      withBudgetAllocations: 0,
    },
  })),
}));

vi.mock("@/lib/data/budgets-repository", () => ({
  getBudgetsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    budgets: [],
    accounts: [],
    funds: [],
    budgetVsActual: null,
    counts: {
      total: 0,
      withLines: 0,
      current: 0,
    },
    summary: {
      totalBudgetedAmount: 0,
    },
  })),
}));

vi.mock("@/lib/data/accounting-repository", () => ({
  getAccountingData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    accounts: [],
    periods: [],
    journalEntries: [],
    counts: {
      totalAccounts: 0,
      activeAccounts: 0,
      openPeriods: 0,
      closedPeriods: 0,
      postedJournalEntries: 0,
      draftJournalEntries: 0,
    },
  })),
}));

vi.mock("@/lib/data/reports-repository", () => ({
  getReportsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    snapshots: {
      recordedGivingTotal: 0,
      nonVoidExpenseTotal: 0,
      openPayablesAmount: 0,
      totalBudgetedAmount: 0,
    },
    summaries: {
      giving: {
        recordedTransactionCount: 0,
        givingThisMonth: 0,
        yearToDateGiving: 0,
      },
      expenses: {
        nonVoidCount: 0,
        totalAmount: 0,
        thisMonthCount: 0,
        amountThisMonth: 0,
      },
      bills: {
        nonVoidCount: 0,
        openCount: 0,
        openAmount: 0,
        paidCount: 0,
      },
      budgets: {
        budgetCount: 0,
        budgetsWithLines: 0,
        totalBudgetedAmount: 0,
      },
      accounting: {
        accountCount: 0,
        accountsByType: [],
        openPeriodCount: 0,
        currentPeriodName: null,
        journalEntryCount: 0,
        postedJournalCount: 0,
        postedDebitTotal: 0,
        postedCreditTotal: 0,
      },
      organization: {
        memberCount: 0,
        vendorCount: 0,
        fundCount: 0,
        fundsWithRecordedGiving: 0,
      },
    },
    availableReports: [],
    unavailableReports: [],
    financialReports: {
      asOfDate: "2026-07-24",
      periodStartDate: "2026-01-01",
      periodEndDate: "2026-07-24",
      trialBalance: {
        asOfDate: "2026-07-24",
        rows: [],
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: true,
      },
      balanceSheet: {
        asOfDate: "2026-07-24",
        sections: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalNetAssets: 0,
        totalLiabilitiesAndNetAssets: 0,
        unclosedChangeInNetAssets: 0,
        isEquationBalanced: true,
      },
      incomeStatement: {
        startDate: "2026-01-01",
        endDate: "2026-07-24",
        revenue: [],
        expenses: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
      },
      fundBalance: {
        asOfDate: "2026-07-24",
        rows: [],
        totalBalance: 0,
      },
    },
    budgetVsActual: null,
  })),
}));

vi.mock("@/lib/data/ai-close-repository", () => ({
  getAiCloseData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    sessions: [],
    pendingTasks: [],
    counts: {
      totalSessions: 0,
      draftSessions: 0,
      inProgressSessions: 0,
      completedSessions: 0,
      totalTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0,
      skippedTasks: 0,
    },
  })),
}));

vi.mock("@/lib/data/compliance-repository", () => ({
  getComplianceData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    items: [],
    categories: [],
    counts: {
      totalItems: 0,
      openItems: 0,
      completedItems: 0,
      notApplicableItems: 0,
      overdueOpenItems: 0,
    },
  })),
}));

vi.mock("@/lib/data/exceptions-repository", () => ({
  getExceptionsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    items: [],
    categories: [],
    counts: {
      totalExceptions: 0,
      highSeverityItems: 0,
      openExceptions: 0,
      resolvedExceptions: 0,
      dismissedExceptions: 0,
    },
  })),
}));

vi.mock("@/lib/data/audit-vault-repository", () => ({
  getAuditVaultData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    events: [],
    documents: [],
    counts: {
      totalEvents: 0,
      totalDocuments: 0,
      eventsThisMonth: 0,
      documentsThisMonth: 0,
    },
  })),
}));

vi.mock("@/lib/data/settings-repository", () => ({
  getSettingsData: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    organization: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Parable Community Church",
      slug: "parable-community-church",
      status: "active",
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: "2026-07-01T12:00:00.000Z",
    },
    currentUserRole: "owner",
    memberships: [],
    settings: null,
    invites: [],
    accounts: [],
    counts: {
      totalMemberships: 0,
    },
  })),
}));

import AccountingPage from "./accounting/page";
import AIClosePage from "./ai-close/page";
import AuditVaultPage from "./audit-vault/page";
import BankingPage from "./banking/page";
import BillsPage from "./bills/page";
import BudgetsPage from "./budgets/page";
import CompliancePage from "./compliance/page";
import DashboardPage from "./dashboard/page";
import ExceptionsPage from "./exceptions/page";
import ExpensesPage from "./expenses/page";
import FundsPage from "./funds/page";
import GivingPage from "./giving/page";
import MembersPage from "./members/page";
import ReportsPage from "./reports/page";
import SettingsPage from "./settings/page";
import TransactionsPage from "./transactions/page";
import VendorsPage from "./vendors/page";

const emptyStateMessage =
  "This workspace section is not yet configured. Live ministry financial data and workflows will appear here in a future implementation phase.";

type WorkspaceRouteDefinition = {
  path: string;
  navId: NavItemId;
  Page: ComponentType;
};

const workspaceRoutes = [
  { path: "/dashboard", navId: "dashboard", Page: DashboardPage },
  { path: "/giving", navId: "giving", Page: GivingPage },
  { path: "/members", navId: "members", Page: MembersPage },
  { path: "/banking", navId: "banking", Page: BankingPage },
  { path: "/transactions", navId: "transactions", Page: TransactionsPage },
  { path: "/expenses", navId: "expenses", Page: ExpensesPage },
  { path: "/bills", navId: "bills", Page: BillsPage },
  { path: "/vendors", navId: "vendors", Page: VendorsPage },
  { path: "/funds", navId: "funds", Page: FundsPage },
  { path: "/budgets", navId: "budgets", Page: BudgetsPage },
  { path: "/accounting", navId: "accounting", Page: AccountingPage },
  { path: "/reports", navId: "reports", Page: ReportsPage },
  { path: "/ai-close", navId: "ai-close", Page: AIClosePage },
  { path: "/compliance", navId: "compliance", Page: CompliancePage },
  { path: "/exceptions", navId: "exceptions", Page: ExceptionsPage },
  { path: "/audit-vault", navId: "audit-vault", Page: AuditVaultPage },
  { path: "/settings", navId: "settings", Page: SettingsPage },
] satisfies WorkspaceRouteDefinition[];

const requiredPaths = [
  "/dashboard",
  "/giving",
  "/members",
  "/banking",
  "/transactions",
  "/expenses",
  "/bills",
  "/vendors",
  "/funds",
  "/budgets",
  "/accounting",
  "/reports",
  "/ai-close",
  "/compliance",
  "/exceptions",
  "/audit-vault",
  "/settings",
];

function navigationItem(navId: NavItemId) {
  const navItem = navItems.find((item) => item.id === navId);

  if (!navItem) {
    throw new Error(`Missing navigation item for navId: ${navId}`);
  }

  return navItem;
}

afterEach(() => {
  cleanup();
});

describe("workspace routes", () => {
  it("represents exactly the 17 approved workspace routes", () => {
    expect(workspaceRoutes).toHaveLength(17);
    expect(workspaceRoutes.map((route) => route.path)).toEqual(requiredPaths);
  });

  it("does not include duplicate route paths or navId values", () => {
    const routePaths = workspaceRoutes.map((route) => route.path);
    const navIds = workspaceRoutes.map((route) => route.navId);

    expect(new Set(routePaths).size).toBe(routePaths.length);
    expect(new Set(navIds).size).toBe(navIds.length);
  });

  it("maps every route path and navId to centralized navigation", () => {
    for (const route of workspaceRoutes) {
      const navItem = navigationItem(route.navId);

      expect(navItem.href).toBe(route.path);
      expect(navItem.id).toBe(route.navId);
    }
  });

  it("renders /settings with live data wiring instead of the shared placeholder", async () => {
    const navItem = navigationItem("settings");
    const page = await SettingsPage();
    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: navItem.title }),
    ).toBeTruthy();
    expect(screen.queryByText(emptyStateMessage)).toBeNull();
    expect(
      screen.getAllByText("No organization memberships yet.").length,
    ).toBeGreaterThan(0);
  });

  it.each([
    { path: "/settings", navId: "settings", Page: SettingsPage },
  ] satisfies WorkspaceRouteDefinition[])(
    "$path does not render fake financial values",
    async ({ Page }) => {
      const page = await Page();
      const { container } = render(page);
      const text = container.textContent ?? "";

      expect(text).not.toMatch(/\$\s?\d|\b\d+\.\d{2}\b/);
    },
  );

  it("renders /audit-vault with live data wiring instead of the shared placeholder", async () => {
    const navItem = navigationItem("audit-vault");
    const page = await AuditVaultPage();
    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: navItem.title }),
    ).toBeTruthy();
    expect(screen.queryByText(emptyStateMessage)).toBeNull();
    expect(screen.getAllByText("No audit records yet.").length).toBeGreaterThan(0);
  });
});
