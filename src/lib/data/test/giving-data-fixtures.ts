import type { GivingData } from "@/lib/data/giving-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyGivingData(
  organizationId: string = TEST_ORGANIZATION_ID,
): GivingData {
  return {
    organizationId,
    transactions: [],
    funds: [],
    summary: {
      givingThisMonth: 0,
      yearToDateGiving: 0,
      transactionCount: 0,
      activeGiverCount: 0,
    },
  };
}

export function createPopulatedGivingData(): GivingData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    funds: [
      {
        id: "fund-1",
        organization_id: TEST_ORGANIZATION_ID,
        name: "General Fund",
        code: "GEN",
        fund_type: "operating",
        status: "active",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
      {
        id: "fund-2",
        organization_id: TEST_ORGANIZATION_ID,
        name: "Missions",
        code: "MIS",
        fund_type: "restricted",
        status: "active",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      },
    ],
    transactions: [
      {
        id: "gift-1",
        organization_id: TEST_ORGANIZATION_ID,
        member_id: "member-1",
        fund_id: "fund-1",
        transaction_date: "2026-07-10",
        amount: 250,
        giving_method: "check",
        reference: "CHK-1001",
        status: "recorded",
        created_at: "2026-07-10T12:00:00.000Z",
        updated_at: "2026-07-10T12:00:00.000Z",
      },
      {
        id: "gift-2",
        organization_id: TEST_ORGANIZATION_ID,
        member_id: "member-2",
        fund_id: "fund-2",
        transaction_date: "2026-07-12",
        amount: 100,
        giving_method: "online",
        reference: null,
        status: "recorded",
        created_at: "2026-07-12T12:00:00.000Z",
        updated_at: "2026-07-12T12:00:00.000Z",
      },
    ],
    summary: {
      givingThisMonth: 350,
      yearToDateGiving: 350,
      transactionCount: 2,
      activeGiverCount: 2,
    },
  };
}
