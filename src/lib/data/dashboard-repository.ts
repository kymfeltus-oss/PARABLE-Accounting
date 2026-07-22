import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import {
  getMonthDateRange,
  sumAmounts,
  unwrapCount,
  unwrapRows,
} from "./query-helpers";
import type {
  AuditEventRow,
  BillRow,
  CloseTaskRow,
  ComplianceItemRow,
  ExceptionRow,
  AmountRow,
} from "./types/rows";

export type DashboardData = {
  organizationId: string;
  openExceptions: ExceptionRow[];
  complianceItems: ComplianceItemRow[];
  openBills: BillRow[];
  closeTasks: CloseTaskRow[];
  recentActivity: AuditEventRow[];
  summary: {
    totalCash: number | null;
    givingThisMonth: number;
    expensesThisMonth: number;
    netOperatingPosition: number;
    openBillCount: number;
    unreconciledTransactionCount: number;
  };
};

export async function getDashboardData(
  organizationId: string,
): Promise<DashboardData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getDashboardData",
  );
  const supabase = await createServerSupabaseClient();
  const { startDate, endDate } = getMonthDateRange();

  const [
    openExceptionsResult,
    complianceItemsResult,
    openBillsResult,
    closeTasksResult,
    recentActivityResult,
    givingThisMonthResult,
    expensesThisMonthResult,
    openBillCountResult,
    unreconciledTransactionCountResult,
  ] = await Promise.all([
    supabase
      .from("exceptions")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("compliance_items")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("due_date", { ascending: true }),
    supabase
      .from("bills")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .in("status", ["draft", "open"])
      .order("due_date", { ascending: true }),
    supabase
      .from("close_tasks")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("audit_events")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("occurred_at", { ascending: false })
      .limit(20),
    supabase
      .from("giving_transactions")
      .select("amount")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "recorded")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate),
    supabase
      .from("expenses")
      .select("total_amount")
      .eq("organization_id", scopedOrganizationId)
      .neq("status", "void")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate),
    supabase
      .from("bills")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", scopedOrganizationId)
      .in("status", ["draft", "open"]),
    supabase
      .from("bank_transactions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "unmatched"),
  ]);

  const openExceptions = unwrapRows<ExceptionRow>(
    "getDashboardData.openExceptions",
    openExceptionsResult,
  );
  const complianceItems = unwrapRows<ComplianceItemRow>(
    "getDashboardData.complianceItems",
    complianceItemsResult,
  );
  const openBills = unwrapRows<BillRow>(
    "getDashboardData.openBills",
    openBillsResult,
  );
  const closeTasks = unwrapRows<CloseTaskRow>(
    "getDashboardData.closeTasks",
    closeTasksResult,
  );
  const recentActivity = unwrapRows<AuditEventRow>(
    "getDashboardData.recentActivity",
    recentActivityResult,
  );
  const givingThisMonth = sumAmounts(
    unwrapRows<AmountRow>(
      "getDashboardData.givingThisMonth",
      givingThisMonthResult,
    ),
  );
  const expensesThisMonth = sumAmounts(
    unwrapRows<{ total_amount: number | string }>(
      "getDashboardData.expensesThisMonth",
      expensesThisMonthResult,
    ).map((expense) => ({ amount: expense.total_amount })),
  );
  const openBillCount = unwrapCount(
    "getDashboardData.openBillCount",
    openBillCountResult,
  );
  const unreconciledTransactionCount = unwrapCount(
    "getDashboardData.unreconciledTransactionCount",
    unreconciledTransactionCountResult,
  );

  return {
    organizationId: scopedOrganizationId,
    openExceptions,
    complianceItems,
    openBills,
    closeTasks,
    recentActivity,
    summary: {
      totalCash: null,
      givingThisMonth,
      expensesThisMonth,
      netOperatingPosition: givingThisMonth - expensesThisMonth,
      openBillCount,
      unreconciledTransactionCount,
    },
  };
}
