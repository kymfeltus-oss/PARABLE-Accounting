import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type {
  AccountingPeriodRow,
  CloseSessionRow,
  CloseTaskRow,
} from "./types/rows";

type AccountingPeriodNameRow = Pick<AccountingPeriodRow, "id" | "name">;

export type CloseSessionRecord = CloseSessionRow & {
  periodName: string | null;
  taskCount: number;
  pendingTaskCount: number;
  inProgressTaskCount: number;
  completedTaskCount: number;
  skippedTaskCount: number;
};

export type CloseTaskRecord = CloseTaskRow & {
  periodName: string | null;
  closeType: string | null;
};

export type AiCloseData = {
  organizationId: string;
  sessions: CloseSessionRecord[];
  pendingTasks: CloseTaskRecord[];
  counts: {
    totalSessions: number;
    draftSessions: number;
    inProgressSessions: number;
    completedSessions: number;
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    skippedTasks: number;
  };
};

function isPendingTask(task: CloseTaskRow): boolean {
  return task.status === "pending" || task.status === "in_progress";
}

function attachSessionTaskCounts(
  sessions: CloseSessionRow[],
  tasks: CloseTaskRow[],
  periodNames: Map<string, string>,
): CloseSessionRecord[] {
  const tasksBySession = new Map<string, CloseTaskRow[]>();

  for (const task of tasks) {
    const sessionTasks = tasksBySession.get(task.close_session_id) ?? [];
    sessionTasks.push(task);
    tasksBySession.set(task.close_session_id, sessionTasks);
  }

  return sessions.map((session) => {
    const sessionTasks = tasksBySession.get(session.id) ?? [];

    return {
      ...session,
      periodName: periodNames.get(session.accounting_period_id) ?? null,
      taskCount: sessionTasks.length,
      pendingTaskCount: sessionTasks.filter((task) => task.status === "pending")
        .length,
      inProgressTaskCount: sessionTasks.filter(
        (task) => task.status === "in_progress",
      ).length,
      completedTaskCount: sessionTasks.filter(
        (task) => task.status === "completed",
      ).length,
      skippedTaskCount: sessionTasks.filter((task) => task.status === "skipped")
        .length,
    };
  });
}

function attachTaskSessionMetadata(
  tasks: CloseTaskRow[],
  sessions: CloseSessionRow[],
  periodNames: Map<string, string>,
): CloseTaskRecord[] {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));

  return tasks.map((task) => {
    const session = sessionsById.get(task.close_session_id);

    return {
      ...task,
      closeType: session?.close_type ?? null,
      periodName: session
        ? (periodNames.get(session.accounting_period_id) ?? null)
        : null,
    };
  });
}

export async function getAiCloseData(
  organizationId: string,
): Promise<AiCloseData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getAiCloseData",
  );
  const supabase = await createServerSupabaseClient();

  const [sessionsResult, tasksResult, periodsResult] = await Promise.all([
    supabase
      .from("close_sessions")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("close_tasks")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("accounting_periods")
      .select("id, name")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const sessions = unwrapRows<CloseSessionRow>(
    "getAiCloseData.sessions",
    sessionsResult,
  );
  const tasks = unwrapRows<CloseTaskRow>("getAiCloseData.tasks", tasksResult);
  const periods = unwrapRows<AccountingPeriodNameRow>(
    "getAiCloseData.periods",
    periodsResult,
  );
  const periodNames = new Map(periods.map((period) => [period.id, period.name]));
  const sessionRecords = attachSessionTaskCounts(sessions, tasks, periodNames);
  const taskRecords = attachTaskSessionMetadata(tasks, sessions, periodNames);
  const pendingTasks = taskRecords.filter(isPendingTask);

  return {
    organizationId: scopedOrganizationId,
    sessions: sessionRecords,
    pendingTasks,
    counts: {
      totalSessions: sessions.length,
      draftSessions: sessions.filter((session) => session.status === "draft")
        .length,
      inProgressSessions: sessions.filter(
        (session) => session.status === "in_progress",
      ).length,
      completedSessions: sessions.filter(
        (session) => session.status === "completed",
      ).length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task) => task.status === "pending").length,
      inProgressTasks: tasks.filter((task) => task.status === "in_progress")
        .length,
      completedTasks: tasks.filter((task) => task.status === "completed").length,
      skippedTasks: tasks.filter((task) => task.status === "skipped").length,
    },
  };
}
