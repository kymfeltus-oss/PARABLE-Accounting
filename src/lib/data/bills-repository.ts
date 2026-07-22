import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { sumAmounts, unwrapRows } from "./query-helpers";
import type { BillRow, VendorRow } from "./types/rows";

export type BillRecord = BillRow & {
  vendorName: string | null;
};

export type BillsData = {
  organizationId: string;
  bills: BillRecord[];
  counts: {
    total: number;
    open: number;
    paid: number;
    overdue: number;
  };
  summary: {
    openAmount: number;
  };
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdueBill(bill: BillRow, today: string): boolean {
  if (bill.status !== "draft" && bill.status !== "open") {
    return false;
  }

  if (!bill.due_date) {
    return false;
  }

  return bill.due_date < today;
}

function attachVendorNames(
  bills: BillRow[],
  vendors: VendorRow[],
): BillRecord[] {
  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));

  return bills.map((bill) => ({
    ...bill,
    vendorName: vendorNames.get(bill.vendor_id) ?? null,
  }));
}

export async function getBillsData(organizationId: string): Promise<BillsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getBillsData",
  );
  const supabase = await createServerSupabaseClient();

  const [billsResult, vendorsResult] = await Promise.all([
    supabase
      .from("bills")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("bill_date", { ascending: false }),
    supabase
      .from("vendors")
      .select("*")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const bills = unwrapRows<BillRow>("getBillsData.bills", billsResult);
  const vendors = unwrapRows<VendorRow>("getBillsData.vendors", vendorsResult);
  const billsWithVendors = attachVendorNames(bills, vendors);
  const today = getTodayDateString();

  const activeBills = bills.filter((bill) => bill.status !== "void");
  const openBills = bills.filter(
    (bill) => bill.status === "draft" || bill.status === "open",
  );
  const paidBills = bills.filter((bill) => bill.status === "paid");
  const overdueBills = bills.filter((bill) => isOverdueBill(bill, today));

  return {
    organizationId: scopedOrganizationId,
    bills: billsWithVendors,
    counts: {
      total: activeBills.length,
      open: openBills.length,
      paid: paidBills.length,
      overdue: overdueBills.length,
    },
    summary: {
      openAmount: sumAmounts(
        openBills.map((bill) => ({ amount: bill.total_amount })),
      ),
    },
  };
}
