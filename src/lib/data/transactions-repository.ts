import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type {
  BankAccountRow,
  BankTransactionMatchRow,
  BankTransactionRow,
} from "./types/rows";

export type BankAccountOption = {
  id: string;
  name: string;
};

export type TransactionsData = {
  organizationId: string;
  transactions: BankTransactionRow[];
  matches: BankTransactionMatchRow[];
  bankAccounts: BankAccountOption[];
  counts: {
    total: number;
    unmatched: number;
    matched: number;
    excluded: number;
  };
};

export async function getTransactionsData(
  organizationId: string,
): Promise<TransactionsData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getTransactionsData",
  );
  const supabase = await createServerSupabaseClient();

  const [transactionsResult, matchesResult, bankAccountsResult] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("bank_transaction_matches")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bank_accounts")
      .select("id, name")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  const transactions = unwrapRows<BankTransactionRow>(
    "getTransactionsData.transactions",
    transactionsResult,
  );
  const matches = unwrapRows<BankTransactionMatchRow>(
    "getTransactionsData.matches",
    matchesResult,
  );
  const bankAccountRows = unwrapRows<Pick<BankAccountRow, "id" | "name">>(
    "getTransactionsData.bankAccounts",
    bankAccountsResult,
  );

  const unmatched = transactions.filter(
    (transaction) => transaction.status === "unmatched",
  ).length;
  const matched = transactions.filter(
    (transaction) => transaction.status === "matched",
  ).length;
  const excluded = transactions.filter(
    (transaction) => transaction.status === "excluded",
  ).length;

  return {
    organizationId: scopedOrganizationId,
    transactions,
    matches,
    bankAccounts: bankAccountRows.map((account) => ({
      id: account.id,
      name: account.name,
    })),
    counts: {
      total: transactions.length,
      unmatched,
      matched,
      excluded,
    },
  };
}
