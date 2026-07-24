import type { BankingData } from "@/lib/data/banking-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

export function createEmptyBankingData(
  organizationId: string = TEST_ORGANIZATION_ID,
): BankingData {
  return {
    organizationId,
    accounts: [],
    transactions: [],
    assetAccounts: [],
    counts: {
      accountCount: 0,
      transactionCount: 0,
      unmatchedTransactionCount: 0,
      matchedTransactionCount: 0,
      totalLedgerCashBalance: 0,
    },
  };
}

export function createPopulatedBankingData(): BankingData {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    accounts: [
      {
        id: "bank-account-1",
        organization_id: TEST_ORGANIZATION_ID,
        account_id: "account-1",
        name: "Operating Account",
        institution_name: "First Ministry Bank",
        account_type: "checking",
        last_four: "1234",
        status: "active",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
        ledgerBalance: 12500,
      },
    ],
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
    ],
    assetAccounts: [
      {
        id: "account-1",
        code: "1000",
        name: "Operating Checking",
      },
    ],
    counts: {
      accountCount: 1,
      transactionCount: 1,
      unmatchedTransactionCount: 1,
      matchedTransactionCount: 0,
      totalLedgerCashBalance: 12500,
    },
  };
}
