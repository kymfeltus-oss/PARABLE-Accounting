import { describe, expect, it, vi } from "vitest";

import { createEmptyBudgetsData } from "@/lib/data/test/budgets-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getBudgetsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getBudgetsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/budgets-repository", () => ({
  getBudgetsData: getBudgetsDataMock,
}));

import BudgetsPage from "./page";
import { BudgetsPageContent } from "@/components/budgets/budgets-page-content";

describe("Budgets page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getBudgetsData", async () => {
    const budgetsData = createEmptyBudgetsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBudgetsDataMock.mockResolvedValue(budgetsData);

    await BudgetsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getBudgetsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned budgets data to BudgetsPageContent", async () => {
    const budgetsData = createEmptyBudgetsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getBudgetsDataMock.mockResolvedValue(budgetsData);

    const page = await BudgetsPage();

    expect(page.type).toBe(BudgetsPageContent);
    expect(page.props.data).toEqual(budgetsData);
  });
});
