import type { DashboardData } from "@/lib/data/dashboard-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyDashboardData(
  organizationId: string = TEST_ORGANIZATION_ID,
): DashboardData {
  return {
    organizationId,
    openExceptions: [],
    complianceItems: [],
    openBills: [],
    closeTasks: [],
    recentActivity: [],
    summary: {
      totalCash: null,
      givingThisMonth: 0,
      expensesThisMonth: 0,
      netOperatingPosition: 0,
      openBillCount: 0,
      unreconciledTransactionCount: 0,
    },
  };
}

export function createPopulatedDashboardData(): DashboardData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    openExceptions: [
      {
        id: "exception-1",
        organization_id: TEST_ORGANIZATION_ID,
        source_type: "bank_transactions",
        source_id: "bank-tx-1",
        title: "Unmatched deposit",
        description: null,
        severity: "high",
        category: "banking",
        status: "open",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
    ],
    complianceItems: [
      {
        id: "compliance-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Form 990 filing",
        category: "tax",
        status: "open",
        due_date: "2026-08-15",
        description: null,
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
    ],
    openBills: [
      {
        id: "bill-1",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: "vendor-1",
        bill_number: "BILL-100",
        bill_date: "2026-07-01",
        description: "Utilities",
        status: "open",
        total_amount: 250,
        due_date: "2026-07-20",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
    ],
    closeTasks: [
      {
        id: "close-task-1",
        organization_id: TEST_ORGANIZATION_ID,
        close_session_id: "close-session-1",
        task_type: "reconciliation",
        title: "Reconcile operating account",
        description: null,
        status: "pending",
        due_at: null,
        completed_at: null,
        sort_order: 1,
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
    ],
    recentActivity: [
      {
        id: "audit-1",
        organization_id: TEST_ORGANIZATION_ID,
        event_type: "bill.created",
        description: "Bill BILL-100 created",
        source_type: "bills",
        source_id: "bill-1",
        actor_type: "system",
        actor_user_id: null,
        occurred_at: "2026-07-01T12:00:00.000Z",
        created_at: "2026-07-01T12:00:00.000Z",
      },
    ],
    summary: {
      totalCash: null,
      givingThisMonth: 1250.5,
      expensesThisMonth: 400,
      netOperatingPosition: 850.5,
      openBillCount: 3,
      unreconciledTransactionCount: 2,
    },
  };
}
