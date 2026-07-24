import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { createMember, getMembersData, updateMember } from "./members-repository";
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

describe("getMembersData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getMembersData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createMockSupabaseClient({
      members: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getMembersData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters members by organization_id", async () => {
    const { client, queryLog } = createMockSupabaseClient({
      members: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getMembersData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(1);
    expect(queryLog[0]?.table).toBe("members");
    expect(hasOrganizationFilter(queryLog[0]!, TEST_ORGANIZATION_ID)).toBe(
      true,
    );
  });

  it("returns empty members and zero counts when the database is empty", async () => {
    const { client } = createMockSupabaseClient({
      members: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getMembersData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.members).toEqual([]);
    expect(result.counts).toEqual({ total: 0, active: 0, inactive: 0 });
  });

  it("throws DataAccessError when Supabase returns an error", async () => {
    const { client } = createMockSupabaseClient({
      members: [{ data: null, error: createBackendError("members query failed") }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getMembersData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});

function createCreatedMemberRow(overrides: Partial<{
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
}> = {}) {
  return {
    id: "66666666-6666-6666-8666-666666666666",
    organization_id: TEST_ORGANIZATION_ID,
    first_name: "Jordan",
    last_name: "Lee",
    email: "jordan.lee@example.org",
    phone: "555-0100",
    status: "active",
    created_at: "2026-07-24T12:00:00.000Z",
    updated_at: "2026-07-24T12:00:00.000Z",
    ...overrides,
  };
}

function createMemberRpcMockClient(rpcResponse: {
  data: unknown;
  error: ReturnType<typeof createBackendError> | null;
}) {
  const { client: tableClient } = createMockSupabaseClient({
    members: [{ data: [], error: null }],
  });
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

describe("createMember", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(
      createMember("", { firstName: "Jordan", lastName: "Lee" }),
    ).rejects.toBeInstanceOf(DataAccessError);
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("calls the create_member RPC with exact argument names", async () => {
    const { client, rpcMock } = createMemberRpcMockClient({
      data: createCreatedMemberRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createMember(TEST_ORGANIZATION_ID, {
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan.lee@example.org",
      phone: "555-0100",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_member", {
      target_organization_id: TEST_ORGANIZATION_ID,
      member_first_name: "Jordan",
      member_last_name: "Lee",
      member_email: "jordan.lee@example.org",
      member_phone: "555-0100",
    });
  });

  it("does not perform a direct members table insert, update, or delete", async () => {
    const { client, fromMock } = createMemberRpcMockClient({
      data: createCreatedMemberRow(),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await createMember(TEST_ORGANIZATION_ID, {
      firstName: "Jordan",
      lastName: "Lee",
    });

    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("updateMember", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("calls the update_member RPC with exact argument names", async () => {
    const { client, rpcMock } = createMemberRpcMockClient({
      data: createCreatedMemberRow({ status: "inactive" }),
      error: null,
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await updateMember(TEST_ORGANIZATION_ID, {
      memberId: "66666666-6666-6666-8666-666666666666",
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan.lee@example.org",
      phone: "555-0100",
      status: "inactive",
    });

    expect(rpcMock).toHaveBeenCalledWith("update_member", {
      target_organization_id: TEST_ORGANIZATION_ID,
      target_member_id: "66666666-6666-6666-8666-666666666666",
      member_first_name: "Jordan",
      member_last_name: "Lee",
      member_email: "jordan.lee@example.org",
      member_phone: "555-0100",
      member_status: "inactive",
    });
  });
});
