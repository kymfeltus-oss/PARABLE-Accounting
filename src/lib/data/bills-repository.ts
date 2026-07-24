import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { sumAmounts, toDataAccessError, unwrapRows } from "./query-helpers";
import type { BillRow, VendorRow } from "./types/rows";

export type BillRecord = BillRow & {
  vendorName: string | null;
};

export type BillStatus = "draft" | "open";

export type CreateBillInput = {
  vendorId: string;
  billDate: string;
  totalAmount: number;
  billNumber?: string | null;
  dueDate?: string | null;
  description?: string | null;
  status?: BillStatus;
  expenseAccountId?: string | null;
  fundId?: string | null;
};

export type PayBillInput = {
  billId: string;
  paymentDate: string;
  cashAccountId: string;
  expenseAccountId: string;
  fundId?: string | null;
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

function requireBillId(billId: string, operation: string): string {
  const trimmed = billId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "billId is required and must be a non-empty string",
    });
  }

  return trimmed;
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

export async function createBill(
  organizationId: string,
  input: CreateBillInput,
): Promise<BillRow> {
  const operation = "createBill";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_bill", {
    target_organization_id: scopedOrganizationId,
    input_vendor_id: input.vendorId,
    input_bill_date: input.billDate,
    input_total_amount: input.totalAmount,
    input_bill_number: input.billNumber ?? null,
    input_due_date: input.dueDate ?? null,
    input_description: input.description ?? null,
    input_status: input.status ?? "draft",
    input_expense_account_id: input.expenseAccountId ?? null,
    input_fund_id: input.fundId ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createBill RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        organizationId: scopedOrganizationId,
        vendorId: input.vendorId,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bill creation returned no row",
    });
  }

  return result.data as BillRow;
}

export async function openBill(
  organizationId: string,
  billId: string,
): Promise<BillRow> {
  const operation = "openBill";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedBillId = requireBillId(billId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("open_bill", {
    target_organization_id: scopedOrganizationId,
    target_bill_id: scopedBillId,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bill open returned no row",
    });
  }

  return result.data as BillRow;
}

export async function payBill(
  organizationId: string,
  input: PayBillInput,
): Promise<BillRow> {
  const operation = "payBill";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedBillId = requireBillId(input.billId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("pay_bill", {
    target_organization_id: scopedOrganizationId,
    target_bill_id: scopedBillId,
    input_payment_date: input.paymentDate,
    input_cash_account_id: input.cashAccountId,
    input_expense_account_id: input.expenseAccountId,
    input_fund_id: input.fundId ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[payBill RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        organizationId: scopedOrganizationId,
        billId: scopedBillId,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bill payment returned no row",
    });
  }

  return result.data as BillRow;
}

export async function voidBill(
  organizationId: string,
  billId: string,
): Promise<BillRow> {
  const operation = "voidBill";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedBillId = requireBillId(billId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("void_bill", {
    target_organization_id: scopedOrganizationId,
    target_bill_id: scopedBillId,
  });

  if (result.error) {
    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bill void returned no row",
    });
  }

  return result.data as BillRow;
}
