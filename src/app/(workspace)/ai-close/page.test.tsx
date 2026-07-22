import { describe, expect, it, vi } from "vitest";

import { createEmptyAiCloseData } from "@/lib/data/test/ai-close-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getAiCloseDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getAiCloseDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/ai-close-repository", () => ({
  getAiCloseData: getAiCloseDataMock,
}));

import AIClosePage from "./page";
import { AiClosePageContent } from "@/components/ai-close/ai-close-page-content";

describe("AI Close page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getAiCloseData", async () => {
    const aiCloseData = createEmptyAiCloseData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getAiCloseDataMock.mockResolvedValue(aiCloseData);

    await AIClosePage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getAiCloseDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned AI Close data to AiClosePageContent", async () => {
    const aiCloseData = createEmptyAiCloseData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getAiCloseDataMock.mockResolvedValue(aiCloseData);

    const page = await AIClosePage();

    expect(page.type).toBe(AiClosePageContent);
    expect(page.props.data).toEqual(aiCloseData);
  });
});
