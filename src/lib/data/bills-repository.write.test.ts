import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createBill, openBill, payBill, voidBill } from "./bills-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const { createServerSupabaseClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

function createBillRpcMockClient(rpcResponse: {
  data: unknown;
  error: { message: string; code?: string } | null;
}) {
  const { client: tableClient } = createMockSupabaseClient({});
  const rpcMock = vi.fn().mockResolvedValue(rpcResponse);

  return {
    client: {
      ...tableClient,
      rpc: rpcMock,
    },
    rpcMock,
  };
}

describe("bills write repository", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("createBill calls create_bill RPC", async () => {
    const { client, rpcMock } = createBillRpcMockClient({
      data: { id: "bill-1", status: "draft" },
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createBill(TEST_ORGANIZATION_ID, {
      vendorId: "vendor-1",
      billDate: "2026-07-01",
      totalAmount: 250,
      status: "draft",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_bill", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_vendor_id: "vendor-1",
      input_bill_date: "2026-07-01",
      input_total_amount: 250,
      input_bill_number: null,
      input_due_date: null,
      input_description: null,
      input_status: "draft",
      input_expense_account_id: null,
      input_fund_id: null,
    });
  });

  it("openBill calls open_bill RPC", async () => {
    const { client, rpcMock } = createBillRpcMockClient({
      data: { id: "bill-1", status: "open" },
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await openBill(TEST_ORGANIZATION_ID, "bill-1");

    expect(rpcMock).toHaveBeenCalledWith("open_bill", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_bill_id: "bill-1",
    });
  });

  it("payBill calls pay_bill RPC", async () => {
    const { client, rpcMock } = createBillRpcMockClient({
      data: { id: "bill-1", status: "paid" },
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await payBill(TEST_ORGANIZATION_ID, {
      billId: "bill-1",
      paymentDate: "2026-07-15",
      cashAccountId: "cash-1",
      expenseAccountId: "expense-1",
      fundId: "fund-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("pay_bill", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_bill_id: "bill-1",
      input_payment_date: "2026-07-15",
      input_cash_account_id: "cash-1",
      input_expense_account_id: "expense-1",
      input_fund_id: "fund-1",
    });
  });

  it("voidBill calls void_bill RPC", async () => {
    const { client, rpcMock } = createBillRpcMockClient({
      data: { id: "bill-1", status: "void" },
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await voidBill(TEST_ORGANIZATION_ID, "bill-1");

    expect(rpcMock).toHaveBeenCalledWith("void_bill", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_bill_id: "bill-1",
    });
  });

  it("throws DataAccessError when payBill RPC fails", async () => {
    const { client } = createBillRpcMockClient({
      data: null,
      error: createBackendError("Bill is not in open status"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      payBill(TEST_ORGANIZATION_ID, {
        billId: "bill-1",
        paymentDate: "2026-07-15",
        cashAccountId: "cash-1",
        expenseAccountId: "expense-1",
      }),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
