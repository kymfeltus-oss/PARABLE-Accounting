import { describe, expect, it, vi } from "vitest";

import { createEmptyDashboardData } from "@/lib/data/test/dashboard-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getDashboardDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getDashboardDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/dashboard-repository", () => ({
  getDashboardData: getDashboardDataMock,
}));

import DashboardPage from "./page";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";

describe("Dashboard page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getDashboardData", async () => {
    const dashboardData = createEmptyDashboardData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getDashboardDataMock.mockResolvedValue(dashboardData);

    await DashboardPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getDashboardDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned dashboard data to DashboardPageContent", async () => {
    const dashboardData = createEmptyDashboardData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getDashboardDataMock.mockResolvedValue(dashboardData);

    const page = await DashboardPage();

    expect(page.type).toBe(DashboardPageContent);
    expect(page.props.data).toEqual(dashboardData);
  });
});
