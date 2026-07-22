import type { VendorsData } from "@/lib/data/vendors-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyVendorsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): VendorsData {
  return {
    organizationId,
    vendors: [],
    counts: {
      total: 0,
      active: 0,
      inactive: 0,
      withBills: 0,
      withExpenses: 0,
    },
  };
}

export function createPopulatedVendorsData(): VendorsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    vendors: [
      {
        id: "vendor-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Northside Supplies",
        email: "accounts@northside.example.org",
        phone: "555-0100",
        tax_id_last_four: "1234",
        status: "active",
        created_at: "2026-06-01T12:00:00.000Z",
        updated_at: "2026-06-01T12:00:00.000Z",
        hasTaxIdOnFile: true,
        billCount: 2,
        expenseCount: 1,
        openBillCount: 1,
        totalBilledAmount: 500,
        totalExpenseAmount: 125.75,
        openBillAmount: 300,
      },
      {
        id: "vendor-2",
        organization_id: TEST_ORGANIZATION_ID,
        name: "City Utilities",
        email: null,
        phone: "555-0200",
        tax_id_last_four: null,
        status: "inactive",
        created_at: "2026-05-15T12:00:00.000Z",
        updated_at: "2026-05-15T12:00:00.000Z",
        hasTaxIdOnFile: false,
        billCount: 0,
        expenseCount: 1,
        openBillCount: 0,
        totalBilledAmount: 0,
        totalExpenseAmount: 240,
        openBillAmount: 0,
      },
    ],
    counts: {
      total: 2,
      active: 1,
      inactive: 1,
      withBills: 1,
      withExpenses: 2,
    },
  };
}
