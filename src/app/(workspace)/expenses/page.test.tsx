import { describe, expect, it, vi } from "vitest";

import { createEmptyExpensesData } from "@/lib/data/test/expenses-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getExpensesDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getExpensesDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/expenses-repository", () => ({
  getExpensesData: getExpensesDataMock,
}));

import ExpensesPage from "./page";
import { ExpensesPageContent } from "@/components/expenses/expenses-page-content";

describe("Expenses page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getExpensesData", async () => {
    const expensesData = createEmptyExpensesData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(expensesData);

    await ExpensesPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getExpensesDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned expenses data to ExpensesPageContent", async () => {
    const expensesData = createEmptyExpensesData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getExpensesDataMock.mockResolvedValue(expensesData);

    const page = await ExpensesPage();

    expect(page.type).toBe(ExpensesPageContent);
    expect(page.props.data).toEqual(expensesData);
  });
});
