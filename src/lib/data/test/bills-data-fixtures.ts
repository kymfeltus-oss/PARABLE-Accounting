import type { BillsData } from "@/lib/data/bills-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyBillsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): BillsData {
  return {
    organizationId,
    bills: [],
    counts: {
      total: 0,
      open: 0,
      paid: 0,
      overdue: 0,
    },
    summary: {
      openAmount: 0,
    },
  };
}

export function createPopulatedBillsData(): BillsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    bills: [
      {
        id: "bill-1",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: "vendor-1",
        vendorName: "Northside Supplies",
        bill_number: "INV-1001",
        bill_date: "2026-07-01",
        due_date: "2026-07-25",
        description: "Office supplies",
        total_amount: 425.5,
        status: "open",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
      {
        id: "bill-2",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: "vendor-2",
        vendorName: "City Utilities",
        bill_number: "UTIL-7788",
        bill_date: "2026-06-15",
        due_date: "2026-06-30",
        description: "Monthly utilities",
        total_amount: 980,
        status: "open",
        created_at: "2026-06-15T12:00:00.000Z",
        updated_at: "2026-06-15T12:00:00.000Z",
      },
      {
        id: "bill-3",
        organization_id: TEST_ORGANIZATION_ID,
        vendor_id: "vendor-1",
        vendorName: "Northside Supplies",
        bill_number: "INV-0990",
        bill_date: "2026-05-01",
        due_date: "2026-05-15",
        description: null,
        total_amount: 150,
        status: "paid",
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-20T12:00:00.000Z",
      },
    ],
    counts: {
      total: 3,
      open: 2,
      paid: 1,
      overdue: 1,
    },
    summary: {
      openAmount: 1405.5,
    },
  };
}
