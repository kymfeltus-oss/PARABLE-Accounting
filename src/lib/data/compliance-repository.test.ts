import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  getComplianceData,
  updateComplianceItemStatus,
} from "./compliance-repository";
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

function createEmptyComplianceMockClient() {
  return createMockSupabaseClient({
    compliance_items: [{ data: [], error: null }],
  });
}

const TEST_COMPLIANCE_ITEM_ID = "22222222-2222-4222-8222-222222222222";

function createUpdatedComplianceItemRow(status: string) {
  return {
    id: TEST_COMPLIANCE_ITEM_ID,
    organization_id: TEST_ORGANIZATION_ID,
    name: "Policy review",
    category: "policy",
    due_date: null,
    status,
    description: null,
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-07-20T18:00:00.000Z",
  };
}

function createComplianceRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient, queryLog } = createEmptyComplianceMockClient();
  const rpcMock = vi.fn().mockResolvedValue(rpcResponse);
  const fromMock = vi.spyOn(tableClient, "from");

  return {
    client: {
      ...tableClient,
      rpc: rpcMock,
    },
    rpcMock,
    fromMock,
    queryLog,
  };
}

describe("getComplianceData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getComplianceData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyComplianceMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getComplianceData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyComplianceMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getComplianceData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(1);
    expect(hasOrganizationFilter(queryLog[0], TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("returns empty compliance data when the database is empty", async () => {
    const { client } = createEmptyComplianceMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getComplianceData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.items).toEqual([]);
    expect(result.counts.totalItems).toBe(0);
  });

  it("counts items using schema-backed status values", async () => {
    const { client } = createMockSupabaseClient({
      compliance_items: [
        {
          data: [
            {
              id: "item-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Open item",
              category: "policy",
              due_date: null,
              status: "open",
              description: null,
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
            {
              id: "item-2",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Completed item",
              category: "governance",
              due_date: null,
              status: "completed",
              description: "Done",
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
            {
              id: "item-3",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Not applicable item",
              category: "other",
              due_date: null,
              status: "not_applicable",
              description: null,
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getComplianceData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      totalItems: 3,
      openItems: 1,
      completedItems: 1,
      notApplicableItems: 1,
      overdueOpenItems: 0,
    });
  });

  it("marks open items with past due dates as overdue", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      compliance_items: [
        {
          data: [
            {
              id: "item-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Overdue item",
              category: "federal_tax",
              due_date: "2026-07-01",
              status: "open",
              description: null,
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
            {
              id: "item-2",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Future item",
              category: "state_tax",
              due_date: "2026-08-01",
              status: "open",
              description: null,
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getComplianceData(TEST_ORGANIZATION_ID);

    expect(result.counts.overdueOpenItems).toBe(1);
  });

  it("aggregates category summaries from compliance items", async () => {
    const { client } = createMockSupabaseClient({
      compliance_items: [
        {
          data: [
            {
              id: "item-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Policy A",
              category: "policy",
              due_date: null,
              status: "open",
              description: null,
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
            {
              id: "item-2",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Policy B",
              category: "policy",
              due_date: null,
              status: "completed",
              description: null,
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getComplianceData(TEST_ORGANIZATION_ID);

    expect(result.categories).toEqual([
      {
        category: "policy",
        itemCount: 2,
        openCount: 1,
        completedCount: 1,
        notApplicableCount: 0,
      },
    ]);
  });

  it("does not expose fabricated framework or control tables", async () => {
    const { client } = createEmptyComplianceMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getComplianceData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("frameworks");
    expect(result).not.toHaveProperty("controls");
    expect(result).not.toHaveProperty("complianceScore");
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      compliance_items: [
        { data: null, error: createBackendError("compliance items failed") },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getComplianceData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

describe("updateComplianceItemStatus", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      updateComplianceItemStatus("", TEST_COMPLIANCE_ITEM_ID, "completed"),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid itemId values", async () => {
    await expect(
      updateComplianceItemStatus(TEST_ORGANIZATION_ID, "", "completed"),
    ).rejects.toBeInstanceOf(DataAccessError);
    await expect(
      updateComplianceItemStatus(TEST_ORGANIZATION_ID, "not-a-uuid", "completed"),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid status values", async () => {
    await expect(
      updateComplianceItemStatus(
        TEST_ORGANIZATION_ID,
        TEST_COMPLIANCE_ITEM_ID,
        "pending" as "open",
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createComplianceRpcMockClient({
      data: createUpdatedComplianceItemRow("completed"),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateComplianceItemStatus(
      TEST_ORGANIZATION_ID,
      TEST_COMPLIANCE_ITEM_ID,
      "completed",
    );

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the update_compliance_item_status RPC with exact argument names", async () => {
    const { client, rpcMock } = createComplianceRpcMockClient({
      data: createUpdatedComplianceItemRow("completed"),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateComplianceItemStatus(
      TEST_ORGANIZATION_ID,
      TEST_COMPLIANCE_ITEM_ID,
      "completed",
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("update_compliance_item_status", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_item_id: TEST_COMPLIANCE_ITEM_ID,
      next_status: "completed",
    });
  });

  it("does not perform a direct compliance_items table update", async () => {
    const { client, fromMock } = createComplianceRpcMockClient({
      data: createUpdatedComplianceItemRow("completed"),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateComplianceItemStatus(
      TEST_ORGANIZATION_ID,
      TEST_COMPLIANCE_ITEM_ID,
      "completed",
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the updated compliance item row from the RPC result", async () => {
    const updatedRow = createUpdatedComplianceItemRow("not_applicable");
    const { client } = createComplianceRpcMockClient({
      data: updatedRow,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await updateComplianceItemStatus(
      TEST_ORGANIZATION_ID,
      TEST_COMPLIANCE_ITEM_ID,
      "not_applicable",
    );

    expect(result).toEqual(updatedRow);
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createComplianceRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to update compliance item status"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      updateComplianceItemStatus(
        TEST_ORGANIZATION_ID,
        TEST_COMPLIANCE_ITEM_ID,
        "completed",
      ),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
