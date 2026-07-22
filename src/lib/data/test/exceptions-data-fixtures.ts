import type { ExceptionsData } from "@/lib/data/exceptions-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyExceptionsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): ExceptionsData {
  return {
    organizationId,
    items: [],
    categories: [],
    counts: {
      totalExceptions: 0,
      highSeverityItems: 0,
      openExceptions: 0,
      resolvedExceptions: 0,
      dismissedExceptions: 0,
    },
  };
}

export function createPopulatedExceptionsData(): ExceptionsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    items: [
      {
        id: "exception-1",
        organization_id: TEST_ORGANIZATION_ID,
        source_type: "bank_transaction",
        source_id: "bank-tx-1",
        category: "banking",
        severity: "high",
        title: "Unmatched bank deposit",
        description: "Deposit has no confirmed match.",
        status: "open",
        created_at: "2026-07-10T12:00:00.000Z",
        updated_at: "2026-07-10T12:00:00.000Z",
      },
      {
        id: "exception-2",
        organization_id: TEST_ORGANIZATION_ID,
        source_type: "journal_entry",
        source_id: "journal-1",
        category: "accounting",
        severity: "medium",
        title: "Unbalanced journal entry",
        description: "Posted entry totals do not balance.",
        status: "resolved",
        created_at: "2026-07-08T12:00:00.000Z",
        updated_at: "2026-07-09T12:00:00.000Z",
      },
      {
        id: "exception-3",
        organization_id: TEST_ORGANIZATION_ID,
        source_type: "expense",
        source_id: null,
        category: "expenses",
        severity: "critical",
        title: "Duplicate expense detected",
        description: null,
        status: "dismissed",
        created_at: "2026-07-05T12:00:00.000Z",
        updated_at: "2026-07-06T12:00:00.000Z",
      },
    ],
    categories: [
      {
        category: "accounting",
        itemCount: 1,
        openCount: 0,
        resolvedCount: 1,
        dismissedCount: 0,
        highSeverityCount: 0,
      },
      {
        category: "banking",
        itemCount: 1,
        openCount: 1,
        resolvedCount: 0,
        dismissedCount: 0,
        highSeverityCount: 1,
      },
      {
        category: "expenses",
        itemCount: 1,
        openCount: 0,
        resolvedCount: 0,
        dismissedCount: 1,
        highSeverityCount: 1,
      },
    ],
    counts: {
      totalExceptions: 3,
      highSeverityItems: 2,
      openExceptions: 1,
      resolvedExceptions: 1,
      dismissedExceptions: 1,
    },
  };
}
