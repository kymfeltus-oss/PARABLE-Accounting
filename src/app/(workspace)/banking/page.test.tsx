import { describe, expect, it, vi } from "vitest";

import { createEmptyBankingData } from "@/lib/data/test/banking-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getBankingDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getBankingDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/banking-repository", () => ({
  getBankingData: getBankingDataMock,
}));

import BankingPage from "./page";
import { BankingPageContent } from "@/components/banking/banking-page-content";

describe("Banking page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getBankingData", async () => {
    const bankingData = createEmptyBankingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBankingDataMock.mockResolvedValue(bankingData);

    await BankingPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getBankingDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned banking data to BankingPageContent", async () => {
    const bankingData = createEmptyBankingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBankingDataMock.mockResolvedValue(bankingData);

    const page = await BankingPage();

    expect(page.type).toBe(BankingPageContent);
    expect(page.props.data).toEqual(bankingData);
  });
});
