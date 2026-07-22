import { describe, expect, it, vi } from "vitest";

import { createEmptyVendorsData } from "@/lib/data/test/vendors-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getVendorsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getVendorsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/vendors-repository", () => ({
  getVendorsData: getVendorsDataMock,
}));

import VendorsPage from "./page";
import { VendorsPageContent } from "@/components/vendors/vendors-page-content";

describe("Vendors page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getVendorsData", async () => {
    const vendorsData = createEmptyVendorsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getVendorsDataMock.mockResolvedValue(vendorsData);

    await VendorsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getVendorsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned vendors data to VendorsPageContent", async () => {
    const vendorsData = createEmptyVendorsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getVendorsDataMock.mockResolvedValue(vendorsData);

    const page = await VendorsPage();

    expect(page.type).toBe(VendorsPageContent);
    expect(page.props.data).toEqual(vendorsData);
  });
});
