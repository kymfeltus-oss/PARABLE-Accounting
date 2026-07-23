import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getExpenseCreditAccountOptions } from "./expense-credit-account-options";
import {
  createBackendError,
  createMockSupabaseClient,
  hasOrganizationFilter,
  TEST_ORGANIZATION_ID,
} from "./test/mock-supabase-client";
import type { AccountRow } from "./types/rows";

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

const OTHER_ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

function createAccountRow(
  overrides: Partial<AccountRow> & Pick<AccountRow, "id" | "code" | "name" | "account_type">,
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

const assetCash = createAccountRow({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  code: "1010",
  name: "Petty Cash",
  account_type: "asset",
});

const liabilityCard = createAccountRow({
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  code: "2100",
  name: "Credit Card Payable",
  account_type: "liability",
});

const liabilityReimbursement = createAccountRow({
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  code: "2110",
  name: "Staff Reimbursements Payable",
  account_type: "liability",
});

const inactiveAsset = createAccountRow({
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  code: "1020",
  name: "Closed Cash Account",
  account_type: "asset",
  status: "inactive",
});

const nonPostingAsset = createAccountRow({
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  code: "1030",
  name: "Header Cash",
  account_type: "asset",
  is_posting: false,
});

const expenseAccount = createAccountRow({
  id: "11111111-1111-4111-8111-111111111111",
  code: "5000",
  name: "Office Expense",
  account_type: "expense",
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
    (filter) => filter.method === method && JSON.stringify(filter.args) === JSON.stringify(args),
  );
}

describe("getExpenseCreditAccountOptions", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      getExpenseCreditAccountOptions("", "bank"),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createAccountsMockClient([assetChecking]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "bank");

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("applies organization_id filter", async () => {
    const { client, queryLog } = createAccountsMockClient([assetChecking]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "bank");

    expect(queryLog).toHaveLength(1);
    expect(hasOrganizationFilter(queryLog[0]!, TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("applies active status filter", async () => {
    const { client, queryLog } = createAccountsMockClient([assetChecking]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "bank");

    expect(hasFilter(queryLog[0]!, "eq", ["status", "active"])).toBe(true);
  });

  it("applies is_posting filter", async () => {
    const { client, queryLog } = createAccountsMockClient([assetChecking]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "bank");

    expect(hasFilter(queryLog[0]!, "eq", ["is_posting", true])).toBe(true);
  });

  it("returns only asset accounts for bank payment source", async () => {
    const { client } = createAccountsMockClient([
      assetCash,
      assetChecking,
      liabilityCard,
      expenseAccount,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "bank",
    );

    expect(result).toEqual([
      {
        id: assetChecking.id,
        code: "1000",
        name: "Operating Checking",
        accountType: "asset",
        displayLabel: "1000 — Operating Checking",
      },
      {
        id: assetCash.id,
        code: "1010",
        name: "Petty Cash",
        accountType: "asset",
        displayLabel: "1010 — Petty Cash",
      },
    ]);
  });

  it("returns only asset accounts for cash payment source", async () => {
    const { client, queryLog } = createAccountsMockClient([
      assetChecking,
      liabilityCard,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "cash");

    expect(hasFilter(queryLog[0]!, "in", ["account_type", ["asset"]])).toBe(true);
  });

  it("returns only liability accounts for card payment source", async () => {
    const { client } = createAccountsMockClient([
      assetChecking,
      liabilityCard,
      liabilityReimbursement,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "card",
    );

    expect(result).toEqual([
      {
        id: liabilityCard.id,
        code: "2100",
        name: "Credit Card Payable",
        accountType: "liability",
        displayLabel: "2100 — Credit Card Payable",
      },
      {
        id: liabilityReimbursement.id,
        code: "2110",
        name: "Staff Reimbursements Payable",
        accountType: "liability",
        displayLabel: "2110 — Staff Reimbursements Payable",
      },
    ]);
  });

  it("returns only liability accounts for reimbursement payment source", async () => {
    const { client, queryLog } = createAccountsMockClient([liabilityReimbursement]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "reimbursement",
    );

    expect(hasFilter(queryLog[0]!, "in", ["account_type", ["liability"]])).toBe(
      true,
    );
  });

  it("returns an empty list for unsupported payment source", async () => {
    const { client } = createAccountsMockClient([assetChecking, liabilityCard]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "other",
    );

    expect(result).toEqual([]);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("returns an empty list for null payment source", async () => {
    const { client } = createAccountsMockClient([assetChecking]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      null,
    );

    expect(result).toEqual([]);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("sorts results by account code then account name", async () => {
    const { client } = createAccountsMockClient([
      createAccountRow({
        id: "sort-2",
        code: "1100",
        name: "Zebra Cash",
        account_type: "asset",
      }),
      createAccountRow({
        id: "sort-1",
        code: "1100",
        name: "Alpha Cash",
        account_type: "asset",
      }),
      createAccountRow({
        id: "sort-3",
        code: "1200",
        name: "Savings",
        account_type: "asset",
      }),
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "bank",
    );

    expect(result.map((option) => option.id)).toEqual([
      "sort-1",
      "sort-2",
      "sort-3",
    ]);
  });

  it("maps displayLabel as code em dash name", async () => {
    const { client } = createAccountsMockClient([assetChecking]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "bank",
    );

    expect(result[0]?.displayLabel).toBe("1000 — Operating Checking");
  });

  it("does not return cross-organization rows", async () => {
    const { client } = createAccountsMockClient([
      assetChecking,
      crossOrgAsset,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getExpenseCreditAccountOptions(
      TEST_ORGANIZATION_ID,
      "bank",
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(assetChecking.id);
    expect(result.some((option) => option.id === crossOrgAsset.id)).toBe(false);
  });

  it("throws DataAccessError using existing repository conventions", async () => {
    const { client } = createMockSupabaseClient({
      accounts: [
        {
          data: null,
          error: createBackendError("Database unavailable"),
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(
      getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "bank"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("excludes inactive and non-posting accounts at query time", async () => {
    const { client, queryLog } = createAccountsMockClient([
      assetChecking,
      inactiveAsset,
      nonPostingAsset,
    ]);
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getExpenseCreditAccountOptions(TEST_ORGANIZATION_ID, "bank");

    expect(hasFilter(queryLog[0]!, "eq", ["status", "active"])).toBe(true);
    expect(hasFilter(queryLog[0]!, "eq", ["is_posting", true])).toBe(true);
  });
});
