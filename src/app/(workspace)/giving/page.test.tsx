import { describe, expect, it, vi } from "vitest";

import { createEmptyGivingData } from "@/lib/data/test/giving-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getGivingDataMock,
  getMembersDataMock,
  getFundsDataMock,
  getGivingDebitAccountOptionsMock,
  getGivingRevenueAccountOptionsMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getGivingDataMock: vi.fn(),
  getMembersDataMock: vi.fn(),
  getFundsDataMock: vi.fn(),
  getGivingDebitAccountOptionsMock: vi.fn(),
  getGivingRevenueAccountOptionsMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/giving-repository", () => ({
  getGivingData: getGivingDataMock,
}));

vi.mock("@/lib/data/members-repository", () => ({
  getMembersData: getMembersDataMock,
}));

vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: getFundsDataMock,
}));

vi.mock("@/lib/data/giving-recording-options", () => ({
  getGivingDebitAccountOptions: getGivingDebitAccountOptionsMock,
  getGivingRevenueAccountOptions: getGivingRevenueAccountOptionsMock,
}));

import GivingPage from "./page";
import { GivingPageContent } from "@/components/giving/giving-page-content";

describe("Giving page wiring", () => {
  it("loads giving data and form options", async () => {
    const givingData = createEmptyGivingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingDataMock.mockResolvedValue(givingData);
    getMembersDataMock.mockResolvedValue({ members: [] });
    getFundsDataMock.mockResolvedValue({ funds: [] });
    getGivingDebitAccountOptionsMock.mockResolvedValue([]);
    getGivingRevenueAccountOptionsMock.mockResolvedValue([]);

    const page = await GivingPage();

    expect(getGivingDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(getMembersDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(page.type).toBe(GivingPageContent);
    expect(page.props.data).toEqual(givingData);
    expect(page.props.memberOptions).toEqual([]);
  });
});
