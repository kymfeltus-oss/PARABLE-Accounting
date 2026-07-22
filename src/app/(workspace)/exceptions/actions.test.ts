import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const ACTIONS_PATH = path.join(
  process.cwd(),
  "src/app/(workspace)/exceptions/actions.ts",
);

const TEST_EXCEPTION_ID = "33333333-3333-4333-8333-333333333333";

const updatedException = {
  id: TEST_EXCEPTION_ID,
  organization_id: TEST_ORGANIZATION_ID,
  source_type: "bank_transaction",
  source_id: "bank-tx-1",
  category: "banking",
  severity: "high",
  title: "Unmatched bank deposit",
  description: "Deposit has no confirmed match.",
  status: "resolved",
  created_at: "2026-07-10T12:00:00.000Z",
  updated_at: "2026-07-20T18:00:00.000Z",
};

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  updateExceptionStatusMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  updateExceptionStatusMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/exceptions-repository", () => ({
  updateExceptionStatus: updateExceptionStatusMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { updateExceptionStatusAction } from "./actions";

describe("updateExceptionStatusAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    updateExceptionStatusMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    updateExceptionStatusMock.mockResolvedValue(updatedException);
  });

  it('is a "use server" action module', () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents.startsWith('"use server";')).toBe(true);
  });

  it("does not accept organizationId from client input", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).toContain("exceptionId: string");
    expect(contents).toContain("nextStatus: ExceptionStatus");
    expect(contents).not.toMatch(/organizationId:\s*string/);
  });

  it("calls getAuthenticatedUser()", async () => {
    await updateExceptionStatusAction({
      exceptionId: TEST_EXCEPTION_ID,
      nextStatus: "resolved",
    });

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("blocks unauthenticated users with a safe structured error", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await updateExceptionStatusAction({
      exceptionId: TEST_EXCEPTION_ID,
      nextStatus: "resolved",
    });

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in to update exceptions.",
    });
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(updateExceptionStatusMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("resolves organization ID server-side and calls the repository with it", async () => {
    const result = await updateExceptionStatusAction({
      exceptionId: TEST_EXCEPTION_ID,
      nextStatus: "resolved",
    });

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
    expect(updateExceptionStatusMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      TEST_EXCEPTION_ID,
      "resolved",
    );
    expect(result).toEqual({ ok: true, item: updatedException });
  });

  it('calls revalidatePath("/exceptions") on success', async () => {
    await updateExceptionStatusAction({
      exceptionId: TEST_EXCEPTION_ID,
      nextStatus: "resolved",
    });

    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/exceptions");
  });

  it("returns a safe error for DataAccessError without exposing raw database details", async () => {
    updateExceptionStatusMock.mockRejectedValue(
      new DataAccessError({
        operation: "updateExceptionStatus",
        message: "Insufficient role to update exception status",
      }),
    );

    const result = await updateExceptionStatusAction({
      exceptionId: TEST_EXCEPTION_ID,
      nextStatus: "resolved",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "Unable to update exception status. Please verify your access and try again.",
      );
      expect(result.error).not.toContain("Insufficient role");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a generic error for unexpected failures", async () => {
    updateExceptionStatusMock.mockRejectedValue(new Error("boom"));

    const result = await updateExceptionStatusAction({
      exceptionId: TEST_EXCEPTION_ID,
      nextStatus: "resolved",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Something went wrong while updating exception status. Please try again.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
