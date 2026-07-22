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

import SettingsPage from "./page";
import { SettingsPageContent } from "@/components/settings/settings-page-content";

describe("Settings page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getSettingsData", async () => {
    const settingsData = createEmptySettingsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getSettingsDataMock.mockResolvedValue(settingsData);

    await SettingsPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getSettingsDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned settings data to SettingsPageContent", async () => {
    const settingsData = createEmptySettingsData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getSettingsDataMock.mockResolvedValue(settingsData);

    const page = await SettingsPage();

    expect(page.type).toBe(SettingsPageContent);
    expect(page.props.data).toEqual(settingsData);
  });
});
