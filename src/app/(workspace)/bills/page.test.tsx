import { describe, expect, it, vi } from "vitest";

import { createEmptyBillsData } from "@/lib/data/test/bills-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getBillsDataMock,
  getVendorsDataMock,
  getAccountingDataMock,
  getFundsDataMock,
  getBillCashAccountOptionsMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getBillsDataMock: vi.fn(),
  getVendorsDataMock: vi.fn(),
  getAccountingDataMock: vi.fn(),
  getFundsDataMock: vi.fn(),
  getBillCashAccountOptionsMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/bills-repository", () => ({
  getBillsData: getBillsDataMock,
}));

vi.mock("@/lib/data/vendors-repository", () => ({
  getVendorsData: getVendorsDataMock,
}));

vi.mock("@/lib/data/accounting-repository", () => ({
  getAccountingData: getAccountingDataMock,
}));

vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: getFundsDataMock,
}));

vi.mock("@/lib/data/bill-payment-options", () => ({
  getBillCashAccountOptions: getBillCashAccountOptionsMock,
}));

import BillsPage from "./page";
import { BillsPageContent } from "@/components/bills/bills-page-content";

describe("Bills page wiring", () => {
  it("loads bills data and form options", async () => {
    const billsData = createEmptyBillsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBillsDataMock.mockResolvedValue(billsData);
    getVendorsDataMock.mockResolvedValue({ vendors: [] });
    getAccountingDataMock.mockResolvedValue({ accounts: [] });
    getFundsDataMock.mockResolvedValue({ funds: [] });
    getBillCashAccountOptionsMock.mockResolvedValue([]);

    const page = await BillsPage();

    expect(getBillsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(getVendorsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(page.type).toBe(BillsPageContent);
    expect(page.props.data).toEqual(billsData);
    expect(page.props.vendorOptions).toEqual([]);
  });
});
