import { describe, expect, it, vi } from "vitest";

import { createEmptyReportsData } from "@/lib/data/test/reports-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getReportsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getReportsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/reports-repository", () => ({
  getReportsData: getReportsDataMock,
}));

import ReportsPage from "./page";
import { ReportsPageContent } from "@/components/reports/reports-page-content";

describe("Reports page wiring", () => {
  it("passes raw report date query params to getReportsData", async () => {
    const reportsData = createEmptyReportsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getReportsDataMock.mockResolvedValue(reportsData);

    await ReportsPage({
      searchParams: Promise.resolve({
        asOf: "2026-06-30",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
      }),
    });

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getReportsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
      asOfDate: "2026-06-30",
      periodStartDate: "2026-04-01",
      periodEndDate: "2026-06-30",
    });
  });

  it("passes returned reports data to ReportsPageContent", async () => {
    const reportsData = createEmptyReportsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getReportsDataMock.mockResolvedValue(reportsData);

    const page = await ReportsPage({
      searchParams: Promise.resolve({}),
    });

    expect(getReportsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
      asOfDate: undefined,
      periodStartDate: undefined,
      periodEndDate: undefined,
    });
    expect(page.type).toBe(ReportsPageContent);
    expect(page.props.data).toEqual(reportsData);
  });
});
