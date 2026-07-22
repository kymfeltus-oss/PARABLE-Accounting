import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type { ExceptionRow } from "./types/rows";

export type ExceptionStatus = "open" | "resolved" | "dismissed";

const EXCEPTION_STATUSES: readonly ExceptionStatus[] = [
  "open",
  "resolved",
  "dismissed",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireExceptionId(exceptionId: string, operation: string): string {
  const trimmed = exceptionId.trim();

  if (!trimmed || !UUID_PATTERN.test(trimmed)) {
    throw new DataAccessError({
      operation,
      message: "exceptionId is required and must be a UUID-shaped value",
    });
  }

  return trimmed;
}

function requireExceptionStatus(
  nextStatus: string,
  operation: string,
): ExceptionStatus {
  if (!EXCEPTION_STATUSES.includes(nextStatus as ExceptionStatus)) {
    throw new DataAccessError({
      operation,
      message: "nextStatus must be one of: open, resolved, dismissed",
    });
  }

  return nextStatus as ExceptionStatus;
}

export type ExceptionCategorySummary = {
  category: string;
  itemCount: number;
  openCount: number;
  resolvedCount: number;
  dismissedCount: number;
  highSeverityCount: number;
};

export type ExceptionsData = {
  organizationId: string;
  items: ExceptionRow[];
  categories: ExceptionCategorySummary[];
  counts: {
    totalExceptions: number;
    highSeverityItems: number;
    openExceptions: number;
    resolvedExceptions: number;
    dismissedExceptions: number;
  };
};

function isHighSeverity(item: ExceptionRow): boolean {
  return item.severity === "high" || item.severity === "critical";
}

function buildCategorySummaries(
  items: ExceptionRow[],
): ExceptionCategorySummary[] {
  const summaries = new Map<string, ExceptionCategorySummary>();

  for (const item of items) {
    const current = summaries.get(item.category) ?? {
      category: item.category,
      itemCount: 0,
      openCount: 0,
      resolvedCount: 0,
      dismissedCount: 0,
      highSeverityCount: 0,
    };

    current.itemCount += 1;

    if (item.status === "open") {
      current.openCount += 1;
    } else if (item.status === "resolved") {
      current.resolvedCount += 1;
    } else if (item.status === "dismissed") {
      current.dismissedCount += 1;
    }

    if (isHighSeverity(item)) {
      current.highSeverityCount += 1;
    }

    summaries.set(item.category, current);
  }

  return [...summaries.values()].sort((left, right) =>
    left.category.localeCompare(right.category),
  );
}

export async function getExceptionsData(
  organizationId: string,
): Promise<ExceptionsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getExceptionsData",
  );
  const supabase = await createServerSupabaseClient();

  const itemsResult = await supabase
    .from("exceptions")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .order("created_at", { ascending: false });

  const items = unwrapRows<ExceptionRow>(
    "getExceptionsData.items",
    itemsResult,
  );

  return {
    organizationId: scopedOrganizationId,
    items,
    categories: buildCategorySummaries(items),
    counts: {
      totalExceptions: items.length,
      highSeverityItems: items.filter(isHighSeverity).length,
      openExceptions: items.filter((item) => item.status === "open").length,
      resolvedExceptions: items.filter((item) => item.status === "resolved")
        .length,
      dismissedExceptions: items.filter((item) => item.status === "dismissed")
        .length,
    },
  };
}

export async function updateExceptionStatus(
  organizationId: string,
  exceptionId: string,
  nextStatus: ExceptionStatus,
): Promise<ExceptionRow> {
  const operation = "updateExceptionStatus";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedExceptionId = requireExceptionId(exceptionId, operation);
  const scopedStatus = requireExceptionStatus(nextStatus, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("update_exception_status", {
    target_organization_id: scopedOrganizationId,
    target_exception_id: scopedExceptionId,
    next_status: scopedStatus,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Exception status update returned no row",
    });
  }

  return result.data as ExceptionRow;
}
