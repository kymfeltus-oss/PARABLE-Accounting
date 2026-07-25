import { describe, expect, it, vi } from "vitest";

import { createEmptySettingsData } from "@/lib/data/test/settings-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getSettingsDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getSettingsDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/settings-repository", () => ({
  getSettingsData: getSettingsDataMock,
}));

import AccountingDefaultsPage from "./page";
import { AccountingDefaultsPageContent } from "@/components/settings/accounting-defaults-page-content";

describe("Accounting defaults page wiring", () => {
  it("loads settings data and renders the accounting defaults page", async () => {
    const settingsData = createEmptySettingsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getSettingsDataMock.mockResolvedValue(settingsData);

    const page = await AccountingDefaultsPage();

    expect(getSettingsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
    expect(page.type).toBe(AccountingDefaultsPageContent);
    expect(page.props.data).toEqual(settingsData);
  });
});
