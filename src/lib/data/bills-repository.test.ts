import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getBillsData } from "./bills-repository";
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

function createEmptyBillsMockClient() {
  return createMockSupabaseClient({
    bills: [{ data: [], error: null }],
    vendors: [{ data: [], error: null }],
  });
}

describe("getBillsData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getBillsData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyBillsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBillsData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters bills and vendors by organization_id", async () => {
    const { client, queryLog } = createEmptyBillsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getBillsData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(2);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty bills and zero counts when the database is empty", async () => {
    const { client } = createEmptyBillsMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBillsData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.bills).toEqual([]);
    expect(result.counts).toEqual({
      total: 0,
      open: 0,
      paid: 0,
      overdue: 0,
    });
    expect(result.summary.openAmount).toBe(0);
  });

  it("derives overdue counts from open bills with due dates before today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      bills: [
        {
          data: [
            {
              id: "bill-overdue",
              organization_id: TEST_ORGANIZATION_ID,
              vendor_id: "vendor-1",
              bill_number: "INV-1",
              bill_date: "2026-07-01",
              due_date: "2026-07-10",
              description: null,
              total_amount: 100,
              status: "open",
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "bill-current",
              organization_id: TEST_ORGANIZATION_ID,
              vendor_id: "vendor-1",
              bill_number: "INV-2",
              bill_date: "2026-07-15",
              due_date: "2026-07-20",
              description: null,
              total_amount: 50,
              status: "open",
              created_at: "2026-07-15T12:00:00.000Z",
              updated_at: "2026-07-15T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      vendors: [
        {
          data: [
            {
              id: "vendor-1",
              organization_id: TEST_ORGANIZATION_ID,
              name: "Northside Supplies",
              email: null,
              phone: null,
              tax_id_last_four: null,
              status: "active",
              created_at: "2026-01-01T12:00:00.000Z",
              updated_at: "2026-01-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getBillsData(TEST_ORGANIZATION_ID);

    expect(result.counts.overdue).toBe(1);
    expect(result.counts.open).toBe(2);
    expect(result.summary.openAmount).toBe(150);
    expect(result.bills[0]?.vendorName).toBe("Northside Supplies");
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      bills: [
        {
          data: null,
          error: createBackendError("bills query failed"),
        },
      ],
      vendors: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getBillsData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
