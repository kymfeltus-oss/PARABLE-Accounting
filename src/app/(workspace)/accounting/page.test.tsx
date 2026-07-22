import { describe, expect, it, vi } from "vitest";

import { createEmptyAccountingData } from "@/lib/data/test/accounting-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getAccountingDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getAccountingDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/accounting-repository", () => ({
  getAccountingData: getAccountingDataMock,
}));

import AccountingPage from "./page";
import { AccountingPageContent } from "@/components/accounting/accounting-page-content";

describe("Accounting page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getAccountingData", async () => {
    const accountingData = createEmptyAccountingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getAccountingDataMock.mockResolvedValue(accountingData);

    await AccountingPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getAccountingDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned accounting data to AccountingPageContent", async () => {
    const accountingData = createEmptyAccountingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getAccountingDataMock.mockResolvedValue(accountingData);

    const page = await AccountingPage();

    expect(page.type).toBe(AccountingPageContent);
    expect(page.props.data).toEqual(accountingData);
  });
});
