import { describe, expect, it, vi } from "vitest";

import { createEmptyGivingData } from "@/lib/data/test/giving-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getGivingDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getGivingDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/giving-repository", () => ({
  getGivingData: getGivingDataMock,
}));

import GivingPage from "./page";
import { GivingPageContent } from "@/components/giving/giving-page-content";

describe("Giving page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getGivingData", async () => {
    const givingData = createEmptyGivingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingDataMock.mockResolvedValue(givingData);

    await GivingPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getGivingDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned giving data to GivingPageContent", async () => {
    const givingData = createEmptyGivingData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getGivingDataMock.mockResolvedValue(givingData);

    const page = await GivingPage();

    expect(page.type).toBe(GivingPageContent);
    expect(page.props.data).toEqual(givingData);
  });
});
