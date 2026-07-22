import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapCount, unwrapRows } from "./query-helpers";
import type { BankAccountRow, BankTransactionRow } from "./types/rows";

export type BankingData = {
  organizationId: string;
  accounts: BankAccountRow[];
  transactions: BankTransactionRow[];
  counts: {
    accountCount: number;
    transactionCount: number;
    unmatchedTransactionCount: number;
  };
};

export async function getBankingData(
  organizationId: string,
): Promise<BankingData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getBankingData",
  );
  const supabase = await createServerSupabaseClient();

  const [accountsResult, transactionsResult, unmatchedCountResult] =
    await Promise.all([
      supabase
        .from("bank_accounts")
        .select("*")
        .eq("organization_id", scopedOrganizationId)
        .order("name", { ascending: true }),
      supabase
        .from("bank_transactions")
        .select("*")
        .eq("organization_id", scopedOrganizationId)
        .order("transaction_date", { ascending: false }),
      supabase
        .from("bank_transactions")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", scopedOrganizationId)
        .eq("status", "unmatched"),
    ]);

  const accounts = unwrapRows<BankAccountRow>(
    "getBankingData.accounts",
    accountsResult,
  );
  const transactions = unwrapRows<BankTransactionRow>(
    "getBankingData.transactions",
    transactionsResult,
  );
  const unmatchedTransactionCount = unwrapCount(
    "getBankingData.unmatchedTransactionCount",
    unmatchedCountResult,
  );

  return {
    organizationId: scopedOrganizationId,
    accounts,
    transactions,
    counts: {
      accountCount: accounts.length,
      transactionCount: transactions.length,
      unmatchedTransactionCount,
    },
  };
}
