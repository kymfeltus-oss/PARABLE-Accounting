import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type { ComplianceItemRow } from "./types/rows";

export type ComplianceItemStatus =
  | "open"
  | "completed"
  | "not_applicable";

const COMPLIANCE_ITEM_STATUSES: readonly ComplianceItemStatus[] = [
  "open",
  "completed",
  "not_applicable",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireComplianceItemId(itemId: string, operation: string): string {
  const trimmed = itemId.trim();

  if (!trimmed || !UUID_PATTERN.test(trimmed)) {
    throw new DataAccessError({
      operation,
      message: "itemId is required and must be a UUID-shaped value",
    });
  }

  return trimmed;
}

function requireComplianceItemStatus(
  nextStatus: string,
  operation: string,
): ComplianceItemStatus {
  if (
    !COMPLIANCE_ITEM_STATUSES.includes(nextStatus as ComplianceItemStatus)
  ) {
    throw new DataAccessError({
      operation,
      message: "nextStatus must be one of: open, completed, not_applicable",
    });
  }

  return nextStatus as ComplianceItemStatus;
}

export type ComplianceCategorySummary = {
  category: string;
  itemCount: number;
  openCount: number;
  completedCount: number;
  notApplicableCount: number;
};

export type ComplianceData = {
  organizationId: string;
  items: ComplianceItemRow[];
  categories: ComplianceCategorySummary[];
  counts: {
    totalItems: number;
    openItems: number;
    completedItems: number;
    notApplicableItems: number;
    overdueOpenItems: number;
  };
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdueOpenItem(item: ComplianceItemRow, today: string): boolean {
  if (item.status !== "open" || !item.due_date) {
    return false;
  }

  return item.due_date < today;
}

function buildCategorySummaries(
  items: ComplianceItemRow[],
): ComplianceCategorySummary[] {
  const summaries = new Map<string, ComplianceCategorySummary>();

  for (const item of items) {
    const current = summaries.get(item.category) ?? {
      category: item.category,
      itemCount: 0,
      openCount: 0,
      completedCount: 0,
      notApplicableCount: 0,
    };

    current.itemCount += 1;

    if (item.status === "open") {
      current.openCount += 1;
    } else if (item.status === "completed") {
      current.completedCount += 1;
    } else if (item.status === "not_applicable") {
      current.notApplicableCount += 1;
    }

    summaries.set(item.category, current);
  }

  return [...summaries.values()].sort((left, right) =>
    left.category.localeCompare(right.category),
  );
}

export async function getComplianceData(
  organizationId: string,
): Promise<ComplianceData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getComplianceData",
  );
  const supabase = await createServerSupabaseClient();
  const today = getTodayDateString();

  const itemsResult = await supabase
    .from("compliance_items")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  const items = unwrapRows<ComplianceItemRow>(
    "getComplianceData.items",
    itemsResult,
  );
  const openItems = items.filter((item) => item.status === "open");

  return {
    organizationId: scopedOrganizationId,
    items,
    categories: buildCategorySummaries(items),
    counts: {
      totalItems: items.length,
      openItems: openItems.length,
      completedItems: items.filter((item) => item.status === "completed").length,
      notApplicableItems: items.filter((item) => item.status === "not_applicable")
        .length,
      overdueOpenItems: openItems.filter((item) =>
        isOverdueOpenItem(item, today),
      ).length,
    },
  };
}

export async function updateComplianceItemStatus(
  organizationId: string,
  itemId: string,
  nextStatus: ComplianceItemStatus,
): Promise<ComplianceItemRow> {
  const operation = "updateComplianceItemStatus";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedItemId = requireComplianceItemId(itemId, operation);
  const scopedStatus = requireComplianceItemStatus(nextStatus, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("update_compliance_item_status", {
    target_organization_id: scopedOrganizationId,
    target_item_id: scopedItemId,
    next_status: scopedStatus,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Compliance item status update returned no row",
    });
  }

  return result.data as ComplianceItemRow;
}
