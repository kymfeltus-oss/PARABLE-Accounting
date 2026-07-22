import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getDashboardData } from "./dashboard-repository";
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

function createEmptyDashboardMockClient() {
  return createMockSupabaseClient({
    exceptions: [{ data: [], error: null }],
    compliance_items: [{ data: [], error: null }],
    bills: [
      { data: [], error: null },
      { count: 0, error: null },
    ],
    close_tasks: [{ data: [], error: null }],
    audit_events: [{ data: [], error: null }],
    giving_transactions: [{ data: [], error: null }],
    expenses: [{ data: [], error: null }],
    bank_transactions: [{ count: 0, error: null }],
  });
}

describe("getDashboardData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getDashboardData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyDashboardMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getDashboardData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters all dashboard queries by organization_id", async () => {
    const { client, queryLog } = createEmptyDashboardMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getDashboardData(TEST_ORGANIZATION_ID);

    expect(queryLog.length).toBe(9);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty collections and zero summary values when the database is empty", async () => {
    const { client } = createEmptyDashboardMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getDashboardData(TEST_ORGANIZATION_ID);

    expect(result.openExceptions).toEqual([]);
    expect(result.complianceItems).toEqual([]);
    expect(result.openBills).toEqual([]);
    expect(result.closeTasks).toEqual([]);
    expect(result.recentActivity).toEqual([]);
    expect(result.summary).toEqual({
      totalCash: null,
      givingThisMonth: 0,
      expensesThisMonth: 0,
      netOperatingPosition: 0,
      openBillCount: 0,
      unreconciledTransactionCount: 0,
    });
  });

  it("returns totalCash as null because the schema has no reliable cash balance field", async () => {
    const { client } = createEmptyDashboardMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getDashboardData(TEST_ORGANIZATION_ID);

    expect(result.summary.totalCash).toBeNull();
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      exceptions: [
        { data: null, error: createBackendError("exceptions query failed") },
      ],
      compliance_items: [{ data: [], error: null }],
      bills: [
        { data: [], error: null },
        { count: 0, error: null },
      ],
      close_tasks: [{ data: [], error: null }],
      audit_events: [{ data: [], error: null }],
      giving_transactions: [{ data: [], error: null }],
      expenses: [{ data: [], error: null }],
      bank_transactions: [{ count: 0, error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getDashboardData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
