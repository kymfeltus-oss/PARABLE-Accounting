import type { TransactionsData } from "@/lib/data/transactions-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyTransactionsData(
  organizationId: string = TEST_ORGANIZATION_ID,
): TransactionsData {
  return {
    organizationId,
    transactions: [],
    matches: [],
    counts: {
      total: 0,
      unmatched: 0,
      matched: 0,
      excluded: 0,
    },
  };
}

export function createPopulatedTransactionsData(): TransactionsData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    transactions: [
      {
        id: "bank-tx-1",
        organization_id: TEST_ORGANIZATION_ID,
        bank_account_id: "bank-account-1",
        transaction_date: "2026-07-10",
        posted_date: "2026-07-11",
        description: "Deposit from offering",
        amount: 500,
        reference: "DEP-1001",
        source_type: "import",
        external_id: null,
        status: "unmatched",
        created_at: "2026-07-10T12:00:00.000Z",
        updated_at: "2026-07-10T12:00:00.000Z",
      },
      {
        id: "bank-tx-2",
        organization_id: TEST_ORGANIZATION_ID,
        bank_account_id: "bank-account-1",
        transaction_date: "2026-07-08",
        posted_date: "2026-07-08",
        description: "Utility payment",
        amount: -120,
        reference: null,
        source_type: "import",
        external_id: null,
        status: "matched",
        created_at: "2026-07-08T12:00:00.000Z",
        updated_at: "2026-07-08T12:00:00.000Z",
      },
    ],
    matches: [
      {
        id: "match-1",
        organization_id: TEST_ORGANIZATION_ID,
        bank_transaction_id: "bank-tx-2",
        source_type: "expenses",
        source_id: "expense-1",
        matched_amount: 120,
        status: "confirmed",
        created_at: "2026-07-09T12:00:00.000Z",
        updated_at: "2026-07-09T12:00:00.000Z",
      },
    ],
    counts: {
      total: 2,
      unmatched: 1,
      matched: 1,
      excluded: 0,
    },
  };
}
