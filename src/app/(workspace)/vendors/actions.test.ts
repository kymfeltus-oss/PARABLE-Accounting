import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "@/lib/data/data-access-error";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const ACTIONS_PATH = path.join(
  process.cwd(),
  "src/app/(workspace)/vendors/actions.ts",
);

const createdVendor = {
  id: "44444444-4444-4444-8444-444444444444",
  organization_id: TEST_ORGANIZATION_ID,
  name: "Northside Supplies",
  email: "accounts@northside.example.org",
  phone: "555-0100",
  tax_id_last_four: "1234",
  status: "active",
  created_at: "2026-07-21T12:00:00.000Z",
  updated_at: "2026-07-21T12:00:00.000Z",
  hasTaxIdOnFile: true,
  billCount: 0,
  expenseCount: 0,
  openBillCount: 0,
  totalBilledAmount: 0,
  totalExpenseAmount: 0,
  openBillAmount: 0,
};

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  createVendorMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  createVendorMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/vendors-repository", () => ({
  createVendor: createVendorMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { createVendorAction } from "./actions";

function createVendorFormData(
  values: Partial<Record<"name" | "email" | "phone" | "taxIdLastFour" | "organizationId", string>> = {},
): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

describe("createVendorAction", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createVendorMock.mockReset();
    revalidatePathMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    createVendorMock.mockResolvedValue(createdVendor);
  });

  it('is a "use server" action module', () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents.startsWith('"use server";')).toBe(true);
  });

  it("calls getAuthenticatedUser()", async () => {
    await createVendorAction(createVendorFormData({ name: "Northside Supplies" }));

    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("resolves organization ID server-side via getCurrentOrganizationId()", async () => {
    await createVendorAction(createVendorFormData({ name: "Northside Supplies" }));

    expect(getCurrentOrganizationIdMock).toHaveBeenCalledTimes(1);
  });

  it("does not accept organizationId from FormData", () => {
    const contents = readFileSync(ACTIONS_PATH, "utf8");

    expect(contents).not.toMatch(/formData\.get\(["']organizationId["']\)/);
    expect(contents).not.toMatch(/formData\.get\(["']organization_id["']\)/);
    expect(contents).toContain("getCurrentOrganizationId()");
  });

  it("ignores organizationId supplied in FormData and uses server-resolved organization ID", async () => {
    await createVendorAction(
      createVendorFormData({
        name: "Northside Supplies",
        organizationId: "99999999-9999-4999-8999-999999999999",
      }),
    );

    expect(createVendorMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({ name: "Northside Supplies" }),
    );
  });

  it("maps name, email, phone, and taxIdLastFour from FormData to createVendor input", async () => {
    await createVendorAction(
      createVendorFormData({
        name: "Northside Supplies",
        email: "accounts@northside.example.org",
        phone: "555-0100",
        taxIdLastFour: "1234",
      }),
    );

    expect(createVendorMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
      name: "Northside Supplies",
      email: "accounts@northside.example.org",
      phone: "555-0100",
      taxIdLastFour: "1234",
    });
  });

  it("converts blank optional FormData values to null", async () => {
    await createVendorAction(
      createVendorFormData({
        name: "Northside Supplies",
        email: "   ",
        phone: "",
        taxIdLastFour: "  ",
      }),
    );

    expect(createVendorMock).toHaveBeenCalledWith(TEST_ORGANIZATION_ID, {
      name: "Northside Supplies",
      email: null,
      phone: null,
      taxIdLastFour: null,
    });
  });

  it("passes organizationId to createVendor as the separate first argument", async () => {
    await createVendorAction(createVendorFormData({ name: "Northside Supplies" }));

    expect(createVendorMock).toHaveBeenCalledTimes(1);
    expect(createVendorMock.mock.calls[0]?.[0]).toBe(TEST_ORGANIZATION_ID);
  });

  it("never sends status or actor_user_id to createVendor", async () => {
    await createVendorAction(createVendorFormData({ name: "Northside Supplies" }));

    const input = createVendorMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("actor_user_id");
  });

  it('calls revalidatePath("/vendors") on success', async () => {
    await createVendorAction(createVendorFormData({ name: "Northside Supplies" }));

    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/vendors");
  });

  it("returns a safe success result with the created vendor", async () => {
    const result = await createVendorAction(
      createVendorFormData({ name: "Northside Supplies" }),
    );

    expect(result).toEqual({ ok: true, vendor: createdVendor });
  });

  it("blocks unauthenticated users with a safe structured error", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await createVendorAction(
      createVendorFormData({ name: "Northside Supplies" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in to create vendors.",
    });
    expect(getCurrentOrganizationIdMock).not.toHaveBeenCalled();
    expect(createVendorMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns Vendor name is required for the repository name validation message", async () => {
    createVendorMock.mockRejectedValue(
      new DataAccessError({
        operation: "createVendor",
        message: "name is required",
      }),
    );

    const result = await createVendorAction(
      createVendorFormData({ name: "   " }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Vendor name is required.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a safe generic error for repository or RPC failures without exposing raw database details", async () => {
    createVendorMock.mockRejectedValue(
      new DataAccessError({
        operation: "createVendor",
        message: "duplicate key value violates unique constraint \"vendors_organization_name_key\"",
      }),
    );

    const result = await createVendorAction(
      createVendorFormData({ name: "Northside Supplies" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "Unable to create vendor. Please verify the information and your access, then try again.",
      );
      expect(result.error).not.toContain("duplicate key");
      expect(result.error).not.toContain("vendors_organization_name_key");
      expect(result.error).not.toContain("SQLSTATE");
    }
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns a generic error for unexpected failures", async () => {
    createVendorMock.mockRejectedValue(new Error("boom"));

    const result = await createVendorAction(
      createVendorFormData({ name: "Northside Supplies" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Something went wrong while creating a vendor. Please try again.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
