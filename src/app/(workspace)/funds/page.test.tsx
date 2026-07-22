import { describe, expect, it, vi } from "vitest";

import { createEmptyFundsData } from "@/lib/data/test/funds-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getFundsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getFundsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/funds-repository", () => ({
  getFundsData: getFundsDataMock,
}));

import FundsPage from "./page";
import { FundsPageContent } from "@/components/funds/funds-page-content";

describe("Funds page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getFundsData", async () => {
    const fundsData = createEmptyFundsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getFundsDataMock.mockResolvedValue(fundsData);

    await FundsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getFundsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned funds data to FundsPageContent", async () => {
    const fundsData = createEmptyFundsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getFundsDataMock.mockResolvedValue(fundsData);

    const page = await FundsPage();

    expect(page.type).toBe(FundsPageContent);
    expect(page.props.data).toEqual(fundsData);
  });
});
