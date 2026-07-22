import type { ComplianceData } from "@/lib/data/compliance-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyComplianceData(
  organizationId: string = TEST_ORGANIZATION_ID,
): ComplianceData {
  return {
    organizationId,
    items: [],
    categories: [],
    counts: {
      totalItems: 0,
      openItems: 0,
      completedItems: 0,
      notApplicableItems: 0,
      overdueOpenItems: 0,
    },
  };
}

export function createPopulatedComplianceData(): ComplianceData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    items: [
      {
        id: "item-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Form 990 filing",
        category: "federal_tax",
        due_date: "2026-05-15",
        status: "open",
        description: "Prepare annual federal tax filing.",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
      },
      {
        id: "item-2",
        organization_id: TEST_ORGANIZATION_ID,
        name: "State charity registration",
        category: "charity_registration",
        due_date: "2026-08-01",
        status: "completed",
        description: "Annual state registration renewal.",
        created_at: "2026-02-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
      {
        id: "item-3",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Legacy payroll filing",
        category: "payroll",
        due_date: "2026-06-01",
        status: "open",
        description: null,
        created_at: "2026-03-01T12:00:00.000Z",
        updated_at: "2026-03-01T12:00:00.000Z",
      },
    ],
    categories: [
      {
        category: "charity_registration",
        itemCount: 1,
        openCount: 0,
        completedCount: 1,
        notApplicableCount: 0,
      },
      {
        category: "federal_tax",
        itemCount: 1,
        openCount: 1,
        completedCount: 0,
        notApplicableCount: 0,
      },
      {
        category: "payroll",
        itemCount: 1,
        openCount: 1,
        completedCount: 0,
        notApplicableCount: 0,
      },
    ],
    counts: {
      totalItems: 3,
      openItems: 2,
      completedItems: 1,
      notApplicableItems: 0,
      overdueOpenItems: 2,
    },
  };
}
