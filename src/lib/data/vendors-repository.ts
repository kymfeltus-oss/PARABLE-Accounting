import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { BillRow, ExpenseRow, VendorRow } from "./types/rows";

type VendorBillAggregationRow = Pick<
  BillRow,
  "vendor_id" | "total_amount" | "status"
>;

type VendorExpenseAggregationRow = Pick<
  ExpenseRow,
  "vendor_id" | "total_amount" | "status"
>;

export type VendorRecord = VendorRow & {
  hasTaxIdOnFile: boolean;
  billCount: number;
  expenseCount: number;
  openBillCount: number;
  totalBilledAmount: number;
  totalExpenseAmount: number;
  openBillAmount: number;
};

export type VendorsData = {
  organizationId: string;
  vendors: VendorRecord[];
  counts: {
    total: number;
    active: number;
    inactive: number;
    withBills: number;
    withExpenses: number;
  };
};

type VendorMetrics = {
  billCount: number;
  expenseCount: number;
  openBillCount: number;
  totalBilledAmount: number;
  totalExpenseAmount: number;
  openBillAmount: number;
};

function createEmptyVendorMetrics(): VendorMetrics {
  return {
    billCount: 0,
    expenseCount: 0,
    openBillCount: 0,
    totalBilledAmount: 0,
    totalExpenseAmount: 0,
    openBillAmount: 0,
  };
}

function isActiveBill(bill: VendorBillAggregationRow): boolean {
  return bill.status !== "void";
}

function isOpenBill(bill: VendorBillAggregationRow): boolean {
  return bill.status === "draft" || bill.status === "open";
}

function isActiveExpense(expense: VendorExpenseAggregationRow): boolean {
  return expense.status !== "void";
}

function buildVendorMetrics(
  vendors: VendorRow[],
  bills: VendorBillAggregationRow[],
  expenses: VendorExpenseAggregationRow[],
): Map<string, VendorMetrics> {
  const metrics = new Map<string, VendorMetrics>(
    vendors.map((vendor) => [vendor.id, createEmptyVendorMetrics()]),
  );

  for (const bill of bills.filter(isActiveBill)) {
    const vendorMetrics = metrics.get(bill.vendor_id);

    if (!vendorMetrics) {
      continue;
    }

    vendorMetrics.billCount += 1;
    vendorMetrics.totalBilledAmount += Number(bill.total_amount);

    if (isOpenBill(bill)) {
      vendorMetrics.openBillCount += 1;
      vendorMetrics.openBillAmount += Number(bill.total_amount);
    }
  }

  for (const expense of expenses.filter(isActiveExpense)) {
    if (!expense.vendor_id) {
      continue;
    }

    const vendorMetrics = metrics.get(expense.vendor_id);

    if (!vendorMetrics) {
      continue;
    }

    vendorMetrics.expenseCount += 1;
    vendorMetrics.totalExpenseAmount += Number(expense.total_amount);
  }

  return metrics;
}

function attachVendorMetrics(
  vendors: VendorRow[],
  metrics: Map<string, VendorMetrics>,
): VendorRecord[] {
  return vendors.map((vendor) => {
    const vendorMetrics = metrics.get(vendor.id) ?? createEmptyVendorMetrics();

    return {
      ...vendor,
      hasTaxIdOnFile: vendor.tax_id_last_four !== null,
      billCount: vendorMetrics.billCount,
      expenseCount: vendorMetrics.expenseCount,
      openBillCount: vendorMetrics.openBillCount,
      totalBilledAmount: vendorMetrics.totalBilledAmount,
      totalExpenseAmount: vendorMetrics.totalExpenseAmount,
      openBillAmount: vendorMetrics.openBillAmount,
    };
  });
}

export async function getVendorsData(
  organizationId: string,
): Promise<VendorsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getVendorsData",
  );
  const supabase = await createServerSupabaseClient();

  const [vendorsResult, billsResult, expensesResult] = await Promise.all([
    supabase
      .from("vendors")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("name", { ascending: true }),
    supabase
      .from("bills")
      .select("vendor_id, total_amount, status")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("expenses")
      .select("vendor_id, total_amount, status")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const vendors = unwrapRows<VendorRow>(
    "getVendorsData.vendors",
    vendorsResult,
  );
  const bills = unwrapRows<VendorBillAggregationRow>(
    "getVendorsData.bills",
    billsResult,
  );
  const expenses = unwrapRows<VendorExpenseAggregationRow>(
    "getVendorsData.expenses",
    expensesResult,
  );
  const metrics = buildVendorMetrics(vendors, bills, expenses);
  const vendorRecords = attachVendorMetrics(vendors, metrics);

  const withBills = vendorRecords.filter((vendor) => vendor.billCount > 0).length;
  const withExpenses = vendorRecords.filter(
    (vendor) => vendor.expenseCount > 0,
  ).length;

  return {
    organizationId: scopedOrganizationId,
    vendors: vendorRecords,
    counts: {
      total: vendors.length,
      active: vendors.filter((vendor) => vendor.status === "active").length,
      inactive: vendors.filter((vendor) => vendor.status === "inactive").length,
      withBills,
      withExpenses,
    },
  };
}
