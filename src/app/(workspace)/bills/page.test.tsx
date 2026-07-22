import { describe, expect, it, vi } from "vitest";

import { createEmptyBillsData } from "@/lib/data/test/bills-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getBillsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getBillsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/bills-repository", () => ({
  getBillsData: getBillsDataMock,
}));

import BillsPage from "./page";
import { BillsPageContent } from "@/components/bills/bills-page-content";

describe("Bills page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getBillsData", async () => {
    const billsData = createEmptyBillsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBillsDataMock.mockResolvedValue(billsData);

    await BillsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getBillsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned bills data to BillsPageContent", async () => {
    const billsData = createEmptyBillsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBillsDataMock.mockResolvedValue(billsData);

    const page = await BillsPage();

    expect(page.type).toBe(BillsPageContent);
    expect(page.props.data).toEqual(billsData);
  });
});
