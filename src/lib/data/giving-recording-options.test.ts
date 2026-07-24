import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import {
  getGivingDebitAccountOptions,
  getGivingRevenueAccountOptions,
} from "./giving-recording-options";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";
import type { AccountRow } from "./types/rows";

vi.mock("server-only", () => ({}));

const { createServerSupabaseClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

const OTHER_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

function createAccountRow(
  overrides: Partial<AccountRow> &
    Pick<AccountRow, "id" | "code" | "name" | "account_type">,
): AccountRow {
  return {
    organization_id: TEST_ORGANIZATION_ID,
    parent_account_id: null,
    is_posting: true,
    status: "active",
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

const assetChecking = createAccountRow({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  code: "1000",
  name: "Operating Checking",
  account_type: "asset",
});

const liabilityCard = createAccountRow({
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  code: "2100",
  name: "Credit Card Payable",
  account_type: "liability",
});

const revenueGeneral = createAccountRow({
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  code: "4000",
  name: "General Contributions",
  account_type: "revenue",
});

const crossOrgAsset = createAccountRow({
  id: "99999999-9999-4999-8999-999999999999",
  code: "1000",
  name: "Other Org Checking",
  account_type: "asset",
  organization_id: OTHER_ORGANIZATION_ID,
});

function createAccountsMockClient(accounts: AccountRow[]) {
  return createMockSupabaseClient({
    accounts: [{ data: accounts, error: null }],
  });
}

function hasFilter(
  query: { filters: { method: string; args: unknown[] }[] },
  method: string,
  args: unknown[],
) {
  return query.filters.some(
    (filter) =>
      filter.method === method &&
      JSON.stringify(filter.args) === JSON.stringify(args),
  );
}

describe("getGivingDebitAccountOptions", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getGivingDebitAccountOptions("", "check")).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("returns only asset accounts for check giving method", async () => {
    const { client } = createAccountsMockClient([
      assetChecking,
      liabilityCard,
      revenueGeneral,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingDebitAccountOptions(
      TEST_ORGANIZATION_ID,
      "check",
    );

    expect(result).toEqual([
      {
        id: assetChecking.id,
        code: "1000",
        name: "Operating Checking",
        accountType: "asset",
        displayLabel: "1000 — Operating Checking",
      },
    ]);
  });

  it("returns asset and liability accounts for card giving method", async () => {
    const { client, queryLog } = createAccountsMockClient([
      assetChecking,
      liabilityCard,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingDebitAccountOptions(
      TEST_ORGANIZATION_ID,
      "card",
    );

    expect(
      hasFilter(queryLog[0]!, "in", ["account_type", ["asset", "liability"]]),
    ).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("returns an empty list for unsupported giving method", async () => {
    const result = await getGivingDebitAccountOptions(
      TEST_ORGANIZATION_ID,
      "unsupported",
    );

    expect(result).toEqual([]);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("does not expose cross-organization accounts", async () => {
    const { client } = createAccountsMockClient([assetChecking, crossOrgAsset]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingDebitAccountOptions(
      TEST_ORGANIZATION_ID,
      "cash",
    );

    expect(result.map((option) => option.id)).toEqual([assetChecking.id]);
  });

  it("throws DataAccessError when repository queries fail", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [{ data: null, error: createBackendError("accounts failed") }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getGivingDebitAccountOptions(TEST_ORGANIZATION_ID, "check"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("getGivingRevenueAccountOptions", () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getGivingRevenueAccountOptions("")).rejects.toBeInstanceOf(
      DataAccessError,
    );
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("applies organization scope and revenue account type filter", async () => {
    const { client, queryLog } = createAccountsMockClient([
      assetChecking,
      revenueGeneral,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getGivingRevenueAccountOptions(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(1);
    expect(hasOrganizationFilter(queryLog[0]!, TEST_ORGANIZATION_ID)).toBe(true);
    expect(hasFilter(queryLog[0]!, "in", ["account_type", ["revenue"]])).toBe(
      true,
    );
  });

  it("returns only revenue accounts", async () => {
    const { client } = createAccountsMockClient([
      assetChecking,
      revenueGeneral,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getGivingRevenueAccountOptions(TEST_ORGANIZATION_ID);

    expect(result).toEqual([
      {
        id: revenueGeneral.id,
        code: "4000",
        name: "General Contributions",
        accountType: "revenue",
        displayLabel: "4000 — General Contributions",
      },
    ]);
  });
});
