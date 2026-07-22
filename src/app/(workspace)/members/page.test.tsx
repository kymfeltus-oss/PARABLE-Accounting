import { describe, expect, it, vi } from "vitest";

import { createEmptyMembersData } from "@/lib/data/test/members-data-fixtures";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getCurrentOrganizationIdMock,
  getMembersDataMock,
} = vi.hoisted(() => ({
  getCurrentOrganizationIdMock: vi.fn(),
  getMembersDataMock: vi.fn(),
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/members-repository", () => ({
  getMembersData: getMembersDataMock,
}));

import MembersPage from "./page";
import { MembersPageContent } from "@/components/members/members-page-content";

describe("Members page wiring", () => {
  it("uses getCurrentOrganizationId and passes the resolved id to getMembersData", async () => {
    const membersData = createEmptyMembersData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getMembersDataMock.mockResolvedValue(membersData);

    await MembersPage();

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(getMembersDataMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID);
  });

  it("passes returned members data to MembersPageContent", async () => {
    const membersData = createEmptyMembersData(TEST_ORGANIZATION_ID);
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    getMembersDataMock.mockResolvedValue(membersData);

    const page = await MembersPage();

    expect(page.type).toBe(MembersPageContent);
    expect(page.props.data).toEqual(membersData);
  });
});
