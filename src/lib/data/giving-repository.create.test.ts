import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createGivingTransaction } from "./giving-repository";
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

function createGivingRpcMockClient(rpcResponse: {
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

const createGivingInput = {
  transactionDate: "2026-07-01",
  amount: 100,
  givingMethod: "cash" as const,
  memberId: null,
  fundId: null,
  reference: "CHK-100",
};

describe("createGivingTransaction", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      createGivingTransaction("", createGivingInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("calls the create_giving_transaction RPC with exact argument names", async () => {
    const { client, rpcMock } = createGivingRpcMockClient({
      data: { id: "gift-1", status: "recorded" },
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createGivingTransaction(TEST_ORGANIZATION_ID, createGivingInput);

    expect(rpcMock).toHaveBeenCalledWith("create_giving_transaction", {
      target_organization_id: TEST_ORGANIZATION_ID,
      input_transaction_date: "2026-07-01",
      input_amount: 100,
      input_giving_method: "cash",
      input_member_id: null,
      input_fund_id: null,
      input_reference: "CHK-100",
    });
  });

  it("throws DataAccessError when RPC fails", async () => {
    const { client } = createGivingRpcMockClient({
      data: null,
      error: createBackendError("Amount must be greater than zero"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createGivingTransaction(TEST_ORGANIZATION_ID, createGivingInput),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
