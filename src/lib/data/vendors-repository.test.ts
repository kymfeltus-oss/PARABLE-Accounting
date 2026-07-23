import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createVendor, getVendorsData } from "./vendors-repository";
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

function createEmptyVendorsMockClient() {
  return createMockSupabaseClient({
    vendors: [{ data: [], error: null }],
    bills: [{ data: [], error: null }],
    expenses: [{ data: [], error: null }],
  });
}

function createCreatedVendorRow(overrides: Partial<{
  id: string;
  email: string | null;
  phone: string | null;
  tax_id_last_four: string | null;
}> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    organization_id: TEST_ORGANIZATION_ID,
    name: "Northside Supplies",
    email: "accounts@northside.example.org",
    phone: "555-0100",
    tax_id_last_four: "1234",
    status: "active",
    created_at: "2026-07-21T12:00:00.000Z",
    updated_at: "2026-07-21T12:00:00.000Z",
    ...overrides,
  };
}

function createVendorRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createEmptyVendorsMockClient();
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

describe("getVendorsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getVendorsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyVendorsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getVendorsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters vendors, bills, and expenses by organization_id", async () => {
    const { client, queryLog } = createEmptyVendorsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getVendorsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(3);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty vendors and zero counts when the database is empty", async () => {
    const { client } = createEmptyVendorsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getVendorsData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.vendors).toEqual([]);
    expect(result.counts).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      withBills: 0,
      withExpenses: 0,
    });
  });

  it("aggregates vendor status and related bill/expense metrics", async () => {
    const { client } = createMockSupabaseClient({
      vendors: [
        {
          data: [
            {
              id: "vendor-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Northside Supplies",
              email: "accounts@northside.example.org",
              phone: null,
              tax_id_last_four: "1234",
              status: "active",
              created_at: "2026-06-01T12:00:00.000Z",
              updated_at: "2026-06-01T12:00:00.000Z",
            },
            {
              id: "vendor-2",
              organization_id: TEST_ORGANIZATION_ID,
              name: "City Utilities",
              email: null,
              phone: null,
              tax_id_last_four: null,
              status: "inactive",
              created_at: "2026-05-01T12:00:00.000Z",
              updated_at: "2026-05-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      bills: [
        {
          data: [
            {
              vendor_id: "vendor-1",
              total_amount: 100,
              status: "open",
            },
            {
              vendor_id: "vendor-1",
              total_amount: 50,
              status: "paid",
            },
            {
              vendor_id: "vendor-1",
              total_amount: 999,
              status: "void",
            },
          ],
          error: null,
        },
      ],
      expenses: [
        {
          data: [
            {
              vendor_id: "vendor-1",
              total_amount: 25,
              status: "recorded",
            },
            {
              vendor_id: "vendor-2",
              total_amount: 40,
              status: "draft",
            },
            {
              vendor_id: "vendor-2",
              total_amount: 500,
              status: "void",
            },
            {
              vendor_id: null,
              total_amount: 10,
              status: "recorded",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getVendorsData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      total: 2,
      active: 1,
      inactive: 1,
      withBills: 1,
      withExpenses: 2,
    });

    const vendorOne = result.vendors.find((vendor) => vendor.id === "vendor-1");
    const vendorTwo = result.vendors.find((vendor) => vendor.id === "vendor-2");

    expect(vendorOne).toMatchObject({
      hasTaxIdOnFile: true,
      billCount: 2,
      expenseCount: 1,
      openBillCount: 1,
      totalBilledAmount: 150,
      totalExpenseAmount: 25,
      openBillAmount: 100,
    });
    expect(vendorOne?.tax_id_last_four).toBe("1234");
    expect(vendorTwo).toMatchObject({
      hasTaxIdOnFile: false,
      billCount: 0,
      expenseCount: 1,
      openBillCount: 0,
      totalBilledAmount: 0,
      totalExpenseAmount: 40,
      openBillAmount: 0,
    });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      vendors: [
        {
          data: null,
          error: createBackendError("vendors query failed"),
        },
      ],
      bills: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getVendorsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

describe("createVendor", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      createVendor("", { name: "Northside Supplies" }),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("rejects blank vendor names", async () => {
    await expect(createVendor(TEST_ORGANIZATION_ID, { name: "   " })).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createVendorRpcMockClient({
      data: createCreatedVendorRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createVendor(TEST_ORGANIZATION_ID, { name: "Northside Supplies" });

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the create_vendor RPC with exact argument names", async () => {
    const { client, rpcMock } = createVendorRpcMockClient({
      data: createCreatedVendorRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createVendor(TEST_ORGANIZATION_ID, {
      name: "Northside Supplies",
      email: "accounts@northside.example.org",
      phone: "555-0100",
      taxIdLastFour: "1234",
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("create_vendor", {
      target_organization_id: TEST_ORGANIZATION_ID,
      vendor_name: "Northside Supplies",
      vendor_email: "accounts@northside.example.org",
      vendor_phone: "555-0100",
      vendor_tax_id_last_four: "1234",
    });
  });

  it("maps omitted optional values to null in the RPC payload", async () => {
    const { client, rpcMock } = createVendorRpcMockClient({
      data: createCreatedVendorRow({
        email: null,
        phone: null,
        tax_id_last_four: null,
      }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createVendor(TEST_ORGANIZATION_ID, { name: "Northside Supplies" });

    expect(rpcMock).toHaveBeenCalledWith("create_vendor", {
      target_organization_id: TEST_ORGANIZATION_ID,
      vendor_name: "Northside Supplies",
      vendor_email: null,
      vendor_phone: null,
      vendor_tax_id_last_four: null,
    });
  });

  it("uses organizationId only from the separate argument", async () => {
    const { client, rpcMock } = createVendorRpcMockClient({
      data: createCreatedVendorRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createVendor(TEST_ORGANIZATION_ID, { name: "Northside Supplies" });

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs.target_organization_id).toBe(TEST_ORGANIZATION_ID);
    expect(rpcArgs).not.toHaveProperty("organization_id");
  });

  it("never sends status or actor_user_id to the RPC", async () => {
    const { client, rpcMock } = createVendorRpcMockClient({
      data: createCreatedVendorRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createVendor(TEST_ORGANIZATION_ID, { name: "Northside Supplies" });

    const rpcArgs = rpcMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs).not.toHaveProperty("status");
    expect(rpcArgs).not.toHaveProperty("actor_user_id");
  });

  it("does not perform a direct vendors table insert, update, or delete", async () => {
    const { client, fromMock } = createVendorRpcMockClient({
      data: createCreatedVendorRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createVendor(TEST_ORGANIZATION_ID, { name: "Northside Supplies" });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the created vendor in the repository public vendor shape", async () => {
    const createdRow = createCreatedVendorRow();
    const { client } = createVendorRpcMockClient({
      data: createdRow,
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await createVendor(TEST_ORGANIZATION_ID, {
      name: "Northside Supplies",
      email: "accounts@northside.example.org",
      phone: "555-0100",
      taxIdLastFour: "1234",
    });

    expect(result).toEqual({
      ...createdRow,
      hasTaxIdOnFile: true,
      billCount: 0,
      expenseCount: 0,
      openBillCount: 0,
      totalBilledAmount: 0,
      totalExpenseAmount: 0,
      openBillAmount: 0,
    });
  });

  it("throws DataAccessError when the RPC fails", async () => {
    const { client } = createVendorRpcMockClient({
      data: null,
      error: createBackendError("Insufficient role to create vendor"),
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      createVendor(TEST_ORGANIZATION_ID, { name: "Northside Supplies" }),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});
