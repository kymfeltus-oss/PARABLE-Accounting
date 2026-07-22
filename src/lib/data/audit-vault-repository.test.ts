import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getAuditVaultData } from "./audit-vault-repository";
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

function createEmptyAuditVaultMockClient() {
  return createMockSupabaseClient({
    audit_events: [{ data: [], error: null }],
    audit_documents: [{ data: [], error: null }],
  });
}

describe("getAuditVaultData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
    vi.useRealTimers();
  });

  it("requires organizationId", async () => {
    await expect(getAuditVaultData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyAuditVaultMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getAuditVaultData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyAuditVaultMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getAuditVaultData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(2);
    expect(queryLog[0].table).toBe("audit_events");
    expect(queryLog[1].table).toBe("audit_documents");
    expect(hasOrganizationFilter(queryLog[0], TEST_ORGANIZATION_ID)).toBe(true);
    expect(hasOrganizationFilter(queryLog[1], TEST_ORGANIZATION_ID)).toBe(true);
  });

  it("returns empty audit vault data when the database is empty", async () => {
    const { client } = createEmptyAuditVaultMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAuditVaultData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.events).toEqual([]);
    expect(result.documents).toEqual([]);
    expect(result.counts).toEqual({
      totalEvents: 0,
      totalDocuments: 0,
      eventsThisMonth: 0,
      documentsThisMonth: 0,
    });
  });

  it("maps audit event and document fields from schema-backed rows", async () => {
    const { client } = createMockSupabaseClient({
      audit_events: [
        {
          data: [
            {
              id: "audit-event-1",
              organization_id: TEST_ORGANIZATION_ID,
              event_type: "journal_entry_posted",
              source_type: "journal_entry",
              source_id: "journal-1",
              actor_type: "user",
              description: "Posted entry",
              occurred_at: "2026-07-10T14:30:00.000Z",
              created_at: "2026-07-10T14:30:00.000Z",
            },
          ],
          error: null,
        },
      ],
      audit_documents: [
        {
          data: [
            {
              id: "audit-document-1",
              organization_id: TEST_ORGANIZATION_ID,
              audit_event_id: "audit-event-1",
              name: "Board Summary",
              document_type: "financial",
              document_date: "2026-07-01",
              description: "Monthly summary",
              status: "active",
              created_at: "2026-07-10T15:00:00.000Z",
              updated_at: "2026-07-10T15:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAuditVaultData(TEST_ORGANIZATION_ID);

    expect(result.events[0]).toEqual({
      id: "audit-event-1",
      organization_id: TEST_ORGANIZATION_ID,
      event_type: "journal_entry_posted",
      source_type: "journal_entry",
      source_id: "journal-1",
      actor_type: "user",
      description: "Posted entry",
      occurred_at: "2026-07-10T14:30:00.000Z",
      created_at: "2026-07-10T14:30:00.000Z",
    });
    expect(result.documents[0]).toEqual({
      id: "audit-document-1",
      organization_id: TEST_ORGANIZATION_ID,
      audit_event_id: "audit-event-1",
      name: "Board Summary",
      document_type: "financial",
      document_date: "2026-07-01",
      description: "Monthly summary",
      status: "active",
      created_at: "2026-07-10T15:00:00.000Z",
      updated_at: "2026-07-10T15:00:00.000Z",
    });
  });

  it("counts monthly KPIs using occurred_at for events and created_at for documents", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));

    const { client } = createMockSupabaseClient({
      audit_events: [
        {
          data: [
            {
              id: "audit-event-1",
              organization_id: TEST_ORGANIZATION_ID,
              event_type: "created",
              source_type: "bill",
              source_id: null,
              actor_type: "system",
              description: null,
              occurred_at: "2026-07-01T12:00:00.000Z",
              created_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "audit-event-2",
              organization_id: TEST_ORGANIZATION_ID,
              event_type: "updated",
              source_type: "expense",
              source_id: null,
              actor_type: "user",
              description: null,
              occurred_at: "2026-06-30T12:00:00.000Z",
              created_at: "2026-06-30T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      audit_documents: [
        {
          data: [
            {
              id: "audit-document-1",
              organization_id: TEST_ORGANIZATION_ID,
              audit_event_id: null,
              name: "Current Month Doc",
              document_type: "other",
              document_date: null,
              description: null,
              status: "active",
              created_at: "2026-07-05T12:00:00.000Z",
              updated_at: "2026-07-05T12:00:00.000Z",
            },
            {
              id: "audit-document-2",
              organization_id: TEST_ORGANIZATION_ID,
              audit_event_id: null,
              name: "Prior Month Doc",
              document_type: "other",
              document_date: null,
              description: null,
              status: "active",
              created_at: "2026-06-01T12:00:00.000Z",
              updated_at: "2026-06-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAuditVaultData(TEST_ORGANIZATION_ID);

    expect(result.counts).toEqual({
      totalEvents: 2,
      totalDocuments: 2,
      eventsThisMonth: 1,
      documentsThisMonth: 1,
    });
  });

  it("does not expose fabricated integrity, compliance, or storage metrics", async () => {
    const { client } = createEmptyAuditVaultMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAuditVaultData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("integrityScore");
    expect(result).not.toHaveProperty("auditReadinessScore");
    expect(result).not.toHaveProperty("tamperAlerts");
    expect(result).not.toHaveProperty("downloadUrls");
    expect(result).not.toHaveProperty("checksumVerified");
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      audit_events: [{ data: null, error: createBackendError("audit events failed") }],
      audit_documents: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getAuditVaultData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
