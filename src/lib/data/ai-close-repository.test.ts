import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./data-access-error";
import { getAiCloseData } from "./ai-close-repository";
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

function createEmptyAiCloseMockClient() {
  return createMockSupabaseClient({
    close_sessions: [{ data: [], error: null }],
    close_tasks: [{ data: [], error: null }],
    accounting_periods: [{ data: [], error: null }],
  });
}

describe("getAiCloseData", () => {
  beforeEach(() => {
    createAdminSupabaseClientMock.mockReset();
    createServerSupabaseClientMock.mockReset();
  });

  it("requires organizationId", async () => {
    await expect(getAiCloseData("")).rejects.toBeInstanceOf(DataAccessError);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("uses createServerSupabaseClient and does not use createAdminSupabaseClient", async () => {
    const { client } = createEmptyAiCloseMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getAiCloseData(TEST_ORGANIZATION_ID);

    expect(createServerSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("filters organization-scoped queries by organization_id", async () => {
    const { client, queryLog } = createEmptyAiCloseMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    await getAiCloseData(TEST_ORGANIZATION_ID);

    expect(queryLog).toHaveLength(3);
    for (const query of queryLog) {
      expect(hasOrganizationFilter(query, TEST_ORGANIZATION_ID)).toBe(true);
    }
  });

  it("returns empty close data when the database is empty", async () => {
    const { client } = createEmptyAiCloseMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAiCloseData(TEST_ORGANIZATION_ID);

    expect(result.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(result.sessions).toEqual([]);
    expect(result.pendingTasks).toEqual([]);
    expect(result.counts.totalSessions).toBe(0);
  });

  it("aggregates session task counts and pending tasks using schema status values", async () => {
    const { client } = createMockSupabaseClient({
      close_sessions: [
        {
          data: [
            {
              id: "session-1",
              organization_id: TEST_ORGANIZATION_ID,
              accounting_period_id: "period-1",
              close_type: "month_end",
              status: "in_progress",
              started_at: "2026-07-01T12:00:00.000Z",
              completed_at: null,
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      close_tasks: [
        {
          data: [
            {
              id: "task-1",
              organization_id: TEST_ORGANIZATION_ID,
              close_session_id: "session-1",
              task_type: "journal_review",
              title: "Review journals",
              description: null,
              status: "pending",
              due_at: null,
              completed_at: null,
              sort_order: 1,
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "task-2",
              organization_id: TEST_ORGANIZATION_ID,
              close_session_id: "session-1",
              task_type: "reconciliation",
              title: "Reconcile account",
              description: null,
              status: "in_progress",
              due_at: null,
              completed_at: null,
              sort_order: 2,
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-01T12:00:00.000Z",
            },
            {
              id: "task-3",
              organization_id: TEST_ORGANIZATION_ID,
              close_session_id: "session-1",
              task_type: "compliance_review",
              title: "Compliance review",
              description: null,
              status: "completed",
              due_at: null,
              completed_at: "2026-07-10T12:00:00.000Z",
              sort_order: 3,
              created_at: "2026-07-01T12:00:00.000Z",
              updated_at: "2026-07-10T12:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      accounting_periods: [
        {
          data: [{ id: "period-1", name: "July 2026" }],
          error: null,
        },
      ],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAiCloseData(TEST_ORGANIZATION_ID);

    expect(result.sessions[0]).toMatchObject({
      periodName: "July 2026",
      taskCount: 3,
      pendingTaskCount: 1,
      inProgressTaskCount: 1,
      completedTaskCount: 1,
    });
    expect(result.pendingTasks).toHaveLength(2);
    expect(result.counts.inProgressSessions).toBe(1);
    expect(result.counts.completedTasks).toBe(1);
  });

  it("does not expose fabricated close automation metrics", async () => {
    const { client } = createEmptyAiCloseMockClient();
    createServerSupabaseClientMock.mockResolvedValue(client);

    const result = await getAiCloseData(TEST_ORGANIZATION_ID);

    expect(result).not.toHaveProperty("matchingPrecisionScore");
    expect(result).not.toHaveProperty("readinessPercentage");
    expect(result).not.toHaveProperty("automatedJournalCount");
  });

  it("throws DataAccessError when a query fails", async () => {
    const { client } = createMockSupabaseClient({
      close_sessions: [
        { data: null, error: createBackendError("close sessions failed") },
      ],
      close_tasks: [{ data: [], error: null }],
      accounting_periods: [{ data: [], error: null }],
    });
    createServerSupabaseClientMock.mockResolvedValue(client);

    await expect(getAiCloseData(TEST_ORGANIZATION_ID)).rejects.toBeInstanceOf(
      DataAccessError,
    );
  });
});
