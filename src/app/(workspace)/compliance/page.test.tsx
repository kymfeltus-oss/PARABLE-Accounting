import { describe, expect, it, vi } from "vitest";

import { createEmptyComplianceData } from "@/lib/data/test/compliance-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getComplianceDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getComplianceDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/compliance-repository", () => ({
  getComplianceData: getComplianceDataMock,
}));

import CompliancePage from "./page";
import { CompliancePageContent } from "@/components/compliance/compliance-page-content";

describe("Compliance page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getComplianceData", async () => {
    const complianceData = createEmptyComplianceData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getComplianceDataMock.mockResolvedValue(complianceData);

    await CompliancePage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getComplianceDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned compliance data to CompliancePageContent", async () => {
    const complianceData = createEmptyComplianceData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getComplianceDataMock.mockResolvedValue(complianceData);

    const page = await CompliancePage();

    expect(page.type).toBe(CompliancePageContent);
    expect(page.props.data).toEqual(complianceData);
  });
});
