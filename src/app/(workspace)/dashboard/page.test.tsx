import { describe, expect, it, vi } from "vitest";

import { createEmptyDashboardData } from "@/lib/data/test/dashboard-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getDashboardDataMock,
  getExpensesDataMock,
  getFundsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getDashboardDataMock: vi.fn(),
  getExpensesDataMock: vi.fn(),
  getFundsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/dashboard-repository", () => ({
  getDashboardData: getDashboardDataMock,
}));
vi.mock("@/lib/data/expenses-repository", () => ({
  getExpensesData: getExpensesDataMock,
}));
vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: getFundsDataMock,
}));

import DashboardPage from "./page";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";

describe("Dashboard page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getDashboardData", async () => {
    const dashboardData = createEmptyDashboardData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getDashboardDataMock.mockResolvedValue(dashboardData);
    getExpensesDataMock.mockResolvedValue({ organizationId: TEST_ORGANIZATION_ID, expenses: [], counts: { total: 0, thisMonth: 0 }, summary: { totalAmount: 0, amountThisMonth: 0 } });
    getFundsDataMock.mockResolvedValue({ organizationId: TEST_ORGANIZATION_ID, funds: [], counts: { total: 0, withGiving: 0, withExpenses: 0, withBudgetAllocations: 0 } });

    await DashboardPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getDashboardDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned dashboard data to DashboardPageContent", async () => {
    const dashboardData = createEmptyDashboardData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getDashboardDataMock.mockResolvedValue(dashboardData);
    getExpensesDataMock.mockResolvedValue({ organizationId: TEST_ORGANIZATION_ID, expenses: [], counts: { total: 0, thisMonth: 0 }, summary: { totalAmount: 0, amountThisMonth: 0 } });
    getFundsDataMock.mockResolvedValue({ organizationId: TEST_ORGANIZATION_ID, funds: [], counts: { total: 0, withGiving: 0, withExpenses: 0, withBudgetAllocations: 0 } });

    const page = await DashboardPage();

    expect(page.type).toBe(DashboardPageContent);
    expect(page.props.data).toEqual(dashboardData);
  });
});
