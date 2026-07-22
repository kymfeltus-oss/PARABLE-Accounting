import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getVendorsData } from "./vendors-repository";
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
