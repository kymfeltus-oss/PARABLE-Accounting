import { describe, expect, it, vi } from "vitest";

import { createEmptyExceptionsData } from "@/lib/data/test/exceptions-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getExceptionsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getExceptionsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/exceptions-repository", () => ({
  getExceptionsData: getExceptionsDataMock,
}));

import ExceptionsPage from "./page";
import { ExceptionsPageContent } from "@/components/exceptions/exceptions-page-content";

describe("Exceptions page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getExceptionsData", async () => {
    const exceptionsData = createEmptyExceptionsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExceptionsDataMock.mockResolvedValue(exceptionsData);

    await ExceptionsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getExceptionsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned exceptions data to ExceptionsPageContent", async () => {
    const exceptionsData = createEmptyExceptionsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExceptionsDataMock.mockResolvedValue(exceptionsData);

    const page = await ExceptionsPage();

    expect(page.type).toBe(ExceptionsPageContent);
    expect(page.props.data).toEqual(exceptionsData);
  });
});
