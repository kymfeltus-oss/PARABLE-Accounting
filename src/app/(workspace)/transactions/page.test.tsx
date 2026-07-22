import { describe, expect, it, vi } from "vitest";

import { createEmptyTransactionsData } from "@/lib/data/test/transactions-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getTransactionsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getTransactionsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/transactions-repository", () => ({
  getTransactionsData: getTransactionsDataMock,
}));

import TransactionsPage from "./page";
import { TransactionsPageContent } from "@/components/transactions/transactions-page-content";

describe("Transactions page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getTransactionsData", async () => {
    const transactionsData = createEmptyTransactionsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getTransactionsDataMock.mockResolvedValue(transactionsData);

    await TransactionsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getTransactionsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned transactions data to TransactionsPageContent", async () => {
    const transactionsData = createEmptyTransactionsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getTransactionsDataMock.mockResolvedValue(transactionsData);

    const page = await TransactionsPage();

    expect(page.type).toBe(TransactionsPageContent);
    expect(page.props.data).toEqual(transactionsData);
  });
});
