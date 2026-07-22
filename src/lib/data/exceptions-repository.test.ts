import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  getExceptionsData,
  updateExceptionStatus,
} from "./exceptions-repository";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";

vi.mock("server-only", () => ({}));

const { createAdminSupabaseClientMock, createServerSupabaseClientMock } =
  vi.hoisted(() => ({
    createAdminSupabaseClientMock: vi.fn(),
    createServerSupabaseClientMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: createAdminSupabaseClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

function createEmptyExceptionsMockClient() {
  return createMockSupabaseClient({
    exceptions: [{ data: [], error: null }],
  });
}

const TEST_EXCEPTION_ID = "33333333-3333-4333-8333-333333333333";

function createUpdatedExceptionRow(status: string) {
  return {
    id: TEST_EXCEPTION_ID,
    organization_id: TEST_ORGANIZATION_ID,
    source_type: "bank_transaction",
    source_id: "bank-tx-1",
    category: "banking",
    severity: "high",
    title: "Unmatched bank deposit",
    description: "Deposit has no confirmed match.",
    status,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-20T18:00:00.000Z",
  };
}

function createExceptionRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyExceptionsMockClient();
  const rpcMock = vi.fn().mockResolvedValue(rpcResponse);
  const fromMock = vi.spyOn(tableClient, "from");

  return {
    client: {
      ...tableClient,
      rpc: rpcMock,
    },
    rpcMock,
    fromMock,
  };
}

describe("getExceptionsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getExceptionsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyExceptionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExceptionsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyExceptionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExceptionsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(1);
    expect(hasOrganizationFilter(queryLog[0], TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("returns empty exceptions data when the database is empty", async () => {
    const { client } = createEmptyExceptionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExceptionsData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.items).toEqual([]);
    expect(result.counts.totalExceptions).toBe(0);
  });

  it("counts exceptions using schema-backed status and severity values", async () => {
    const { client } = createMockSupabaseClient({
      exceptions: [
        {
          data: [
            {
              id: "exception-1",
              organization_id: TEST_ORGANIZATION_ID,
              source_type: "bank_transaction",
              source_id: null,
              category: "banking",
              severity: "high",
              title: "Open high severity",
              description: null,
              status: "open",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "exception-2",
              organization_id: TEST_ORGANIZATION_ID,
              source_type: "expense",
              source_id: null,
              category: "expenses",
              severity: "critical",
              title: "Critical resolved",
              description: "Resolved",
              status: "resolved",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-02T12:00:00.000Z",
            },
            {
              id: "exception-3",
              organization_id: TEST_ORGANIZATION_ID,
              source_type: "bill",
              source_id: null,
              category: "bills",
              severity: "low",
              title: "Dismissed low",
              description: null,
              status: "dismissed",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-03T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExceptionsData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      totalExceptions: 3,
      highSeverityItems: 2,
      openExceptions: 1,
      resolvedExceptions: 1,
      dismissedExceptions: 1,
    });
  });

  it("aggregates category summaries from exception items", async () => {
    const { client } = createMockSupabaseClient({
      exceptions: [
        {
          data: [
            {
              id: "exception-1",
              organization_id: TEST_ORGANIZATION_ID,
              source_type: "bank_transaction",
              source_id: null,
              category: "banking",
              severity: "high",
              title: "Banking A",
              description: null,
              status: "open",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "exception-2",
              organization_id: TEST_ORGANIZATION_ID,
              source_type: "bank_transaction",
              source_id: null,
              category: "banking",
              severity: "medium",
              title: "Banking B",
              description: null,
              status: "resolved",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-02T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExceptionsData(TEST_ORGANIZATION_ID);

    expect(result.categories).toEqual([
      {
        category: "banking",
        itemCount: 2,
        openCount: 1,
        resolvedCount: 1,
        dismissedCount: 0,
        highSeverityCount: 1,
      },
    ]);
  });

  it("does not expose fabricated transaction exception tables or remediation metrics", async () => {
    const { client } = createEmptyExceptionsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExceptionsData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("transactionExceptions");
    expect(result).not.toHaveProperty("amountDiscrepancyTotal");
    expect(result).not.toHaveProperty("remediationScore");
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      exceptions: [{ data: null, error: createBackendError("exceptions failed") }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getExceptionsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

describe("updateExceptionStatus", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      updateExceptionStatus("", TEST_EXCEPTION_ID, "resolved"),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid exceptionId values", async () => {
    await expect(
      updateExceptionStatus(TEST_ORGANIZATION_ID, "", "resolved"),
    ).rejects.toBeInstanceOf(DataAccessError);
    await expect(
      updateExceptionStatus(TEST_ORGANIZATION_ID, "not-a-uuid", "resolved"),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid status values", async () => {
    await expect(
      updateExceptionStatus(
        TEST_ORGANIZATION_ID,
        TEST_EXCEPTION_ID,
        "completed" as "open",
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createExceptionRpcMockClient({
      data: createUpdatedExceptionRow("resolved"),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateExceptionStatus(
      TEST_ORGANIZATION_ID,
      TEST_EXCEPTION_ID,
      "resolved",
    );

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the update_exception_status RPC with exact argument names", async () => {
    const { client, rpcMock } = createExceptionRpcMockClient({
      data: createUpdatedExceptionRow("resolved"),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateExceptionStatus(
      TEST_ORGANIZATION_ID,
      TEST_EXCEPTION_ID,
      "resolved",
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("update_exception_status", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_exception_id: TEST_EXCEPTION_ID,
      next_status: "resolved",
    });
  });

  it("does not perform a direct exceptions table update", async () => {
    const { client, fromMock } = createExceptionRpcMockClient({
      data: createUpdatedExceptionRow("resolved"),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateExceptionStatus(
      TEST_ORGANIZATION_ID,
      TEST_EXCEPTION_ID,
      "resolved",
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the updated exception row from the RPC result", async () => {
    const updatedRow = createUpdatedExceptionRow("dismissed");
    const { client } = createExceptionRpcMockClient({
      data: updatedRow,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await updateExceptionStatus(
      TEST_ORGANIZATION_ID,
      TEST_EXCEPTION_ID,
      "dismissed",
    );

    expect(result).toEqual(updatedRow);
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createExceptionRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to update exception status"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      updateExceptionStatus(
        TEST_ORGANIZATION_ID,
        TEST_EXCEPTION_ID,
        "resolved",
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
