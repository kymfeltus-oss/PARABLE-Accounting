import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const ACTIONS_PATH = path.join(
  process.cwd(),
  "src/app/(workspace)/compliance/actions.ts",
);

const TEST_COMPLIANCE_ITEM_ID = "22222222-2222-4222-8222-222222222222";

const updatedComplianceItem = {
  id: TEST_COMPLIANCE_ITEM_ID,
  organization_id: TEST_ORGANIZATION_ID,
  name: "Policy review",
  category: "policy",
  due_date: null,
  status: "completed",
  description: null,
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: "2026-07-20T18:00:00.000Z",
};

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  updateComplianceItemStatusMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  updateComplianceItemStatusMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/compliance-repository", () => ({
  updateComplianceItemStatus: updateComplianceItemStatusMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { updateComplianceItemStatusAction } from "./actions";

describe("updateComplianceItemStatusAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    updateComplianceItemStatusMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    updateComplianceItemStatusMock.mockResolvedValue(updatedComplianceItem);
  });

  it('is a "use server" action module', () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents.startsWith('"use server";')).toBe(true);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("itemId: string");
    expect(contents).toContain("nextStatus: ComplianceItemStatus");
    expect(contents).not.toMatch(/organizationId:\s*string/);
  });

  it("calls getAuthenticatedUser()", async () => {
    await updateComplianceItemStatusAction({
      itemId: TEST_COMPLIANCE_ITEM_ID,
      nextStatus: "completed",
    });

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("blocks unauthenticated users with a safe structured error", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await updateComplianceItemStatusAction({
      itemId: TEST_COMPLIANCE_ITEM_ID,
      nextStatus: "completed",
    });

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in to update compliance items.",
    });
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(updateComplianceItemStatusMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("resolves organization ID server-side and calls the repository with it", async () => {
    const result = await updateComplianceItemStatusAction({
      itemId: TEST_COMPLIANCE_ITEM_ID,
      nextStatus: "completed",
    });

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(updateComplianceItemStatusMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      TEST_COMPLIANCE_ITEM_ID,
      "completed",
    );
    expect(result).toEqual({ ok: true, item: updatedComplianceItem });
  });

  it('calls revalidatePath("/compliance") on success', async () => {
    await updateComplianceItemStatusAction({
      itemId: TEST_COMPLIANCE_ITEM_ID,
      nextStatus: "completed",
    });

    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/compliance");
  });

  it("returns a safe error for DataAccessError without exposing raw database details", async () => {
    updateComplianceItemStatusMock.mockRejectedValue(
      new DataAccessError({
        operation: "updateComplianceItemStatus",
        message: "Insufficient role to update compliance item status",
      }),
    );

    const result = await updateComplianceItemStatusAction({
      itemId: TEST_COMPLIANCE_ITEM_ID,
      nextStatus: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "Unable to update compliance item status. Please verify your access and try again.",
      );
      expect(result.error).not.toContain("Insufficient role");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a generic error for unexpected failures", async () => {
    updateComplianceItemStatusMock.mockRejectedValue(new Error("boom"));

    const result = await updateComplianceItemStatusAction({
      itemId: TEST_COMPLIANCE_ITEM_ID,
      nextStatus: "completed",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Something went wrong while updating compliance item status. Please try again.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
