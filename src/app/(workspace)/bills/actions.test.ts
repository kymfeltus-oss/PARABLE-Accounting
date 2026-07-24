import { beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  getAuthenticatedUserMock,
  getCurrentOrganizationIdMock,
  createBillMock,
  openBillMock,
  payBillMock,
  voidBillMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  getCurrentOrganizationIdMock: vi.fn(),
  createBillMock: vi.fn(),
  openBillMock: vi.fn(),
  payBillMock: vi.fn(),
  voidBillMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/lib/data/organization-context", () => ({
  getCurrentOrganizationId: getCurrentOrganizationIdMock,
}));

vi.mock("@/lib/data/bills-repository", () => ({
  createBill: createBillMock,
  openBill: openBillMock,
  payBill: payBillMock,
  voidBill: voidBillMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createBillAction,
  openBillAction,
  payBillAction,
  voidBillAction,
} from "./actions";

describe("bills actions", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getCurrentOrganizationIdMock.mockReset();
    createBillMock.mockReset();
    openBillMock.mockReset();
    payBillMock.mockReset();
    voidBillMock.mockReset();

    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });
    getCurrentOrganizationIdMock.mockResolvedValue(TEST_ORGANIZATION_ID);
    createBillMock.mockResolvedValue({ id: "bill-1" });
    openBillMock.mockResolvedValue({ id: "bill-1", status: "open" });
    payBillMock.mockResolvedValue({ id: "bill-1", status: "paid" });
    voidBillMock.mockResolvedValue({ id: "bill-1", status: "void" });
  });

  it("createBillAction delegates to createBill", async () => {
    const result = await createBillAction({
      vendorId: "11111111-1111-4111-8111-111111111111",
      billDate: "2026-07-01",
      totalAmount: 250,
    });

    expect(result).toEqual({ success: true, billId: "bill-1" });
    expect(createBillMock).toHaveBeenCalledWith(
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        vendorId: "11111111-1111-4111-8111-111111111111",
        totalAmount: 250,
      }),
    );
  });

  it("openBillAction delegates to openBill", async () => {
    const result = await openBillAction({
      billId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({
      success: true,
      billId: "bill-1",
      status: "open",
    });
  });

  it("payBillAction delegates to payBill", async () => {
    const result = await payBillAction({
      billId: "11111111-1111-4111-8111-111111111111",
      paymentDate: "2026-07-15",
      cashAccountId: "22222222-2222-4222-8222-222222222222",
      expenseAccountId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result).toEqual({
      success: true,
      billId: "bill-1",
      status: "paid",
    });
  });

  it("voidBillAction delegates to voidBill", async () => {
    const result = await voidBillAction({
      billId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({
      success: true,
      billId: "bill-1",
      status: "void",
    });
  });
});
