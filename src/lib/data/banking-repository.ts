import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { buildAccountBalanceMap } from "./ledger-balances";
import { loadLedgerBalanceContext } from "./ledger-balances-repository";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapCount, unwrapRows } from "./query-helpers";
import type { AccountRow, BankAccountRow, BankTransactionRow } from "./types/rows";

export type BankAccountRecord = BankAccountRow & {
  ledgerBalance: number;
};

export type AssetAccountOption = {
  id: string;
  code: string;
  name: string;
};

export type BankingData = {
  organizationId: string;
  accounts: BankAccountRecord[];
  transactions: BankTransactionRow[];
  assetAccounts: AssetAccountOption[];
  counts: {
    accountCount: number;
    transactionCount: number;
    unmatchedTransactionCount: number;
    matchedTransactionCount: number;
    totalLedgerCashBalance: number;
  };
};

export type CreateBankAccountInput = {
  name: string;
  accountId: string;
  institutionName?: string | null;
  accountType?: string | null;
  lastFour?: string | null;
};

export type CreateBankTransactionInput = {
  bankAccountId: string;
  transactionDate: string;
  amount: number;
  description?: string | null;
  transactionType?: "inbound" | "outbound" | null;
};

export type MatchBankTransactionInput = {
  bankTransactionId: string;
  matchType: "bill_payment" | "expense" | "giving_transaction" | "journal_entry";
  matchedSourceId: string;
};

function requireNonEmptyField(
  value: string,
  field: string,
  operation: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: `${field} is required`,
    });
  }

  return trimmed;
}

function toAssetAccountOption(account: AccountRow): AssetAccountOption {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
  };
}

function attachLedgerBalances(
  accounts: BankAccountRow[],
  accountBalanceMap: Map<string, number>,
): BankAccountRecord[] {
  return accounts.map((account) => ({
    ...account,
    ledgerBalance: accountBalanceMap.get(account.account_id) ?? 0,
  }));
}

export async function getBankingData(
  organizationId: string,
): Promise<BankingData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getBankingData",
  );
  const supabase = await createServerSupabaseClient();

  const [accountsResult, transactionsResult, unmatchedCountResult, assetAccountsResult] =
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
      supabase
        .from("accounts")
        .select("id, code, name, account_type, status, is_posting")
        .eq("organization_id", scopedOrganizationId)
        .eq("status", "active")
        .eq("is_posting", true)
        .eq("account_type", "asset")
        .order("code", { ascending: true }),
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
  const assetAccountRows = unwrapRows<
    Pick<AccountRow, "id" | "code" | "name" | "account_type" | "status" | "is_posting">
  >("getBankingData.assetAccounts", assetAccountsResult);

  const ledgerContext = await loadLedgerBalanceContext(scopedOrganizationId);
  const accountBalanceMap = buildAccountBalanceMap(
    ledgerContext.lines,
    ledgerContext.accounts,
    ledgerContext.asOfDate,
  );
  const accountRecords = attachLedgerBalances(accounts, accountBalanceMap);
  const matchedTransactionCount = transactions.filter(
    (transaction) => transaction.status === "matched",
  ).length;
  const totalLedgerCashBalance = accountRecords.reduce(
    (total, account) => total + account.ledgerBalance,
    0,
  );

  return {
    organizationId: scopedOrganizationId,
    accounts: accountRecords,
    transactions,
    assetAccounts: assetAccountRows.map((account) =>
      toAssetAccountOption(account as AccountRow),
    ),
    counts: {
      accountCount: accounts.length,
      transactionCount: transactions.length,
      unmatchedTransactionCount,
      matchedTransactionCount,
      totalLedgerCashBalance,
    },
  };
}

export async function createBankAccount(
  organizationId: string,
  input: CreateBankAccountInput,
): Promise<BankAccountRow> {
  const operation = "createBankAccount";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const name = requireNonEmptyField(input.name, "name", operation);
  const accountId = requireNonEmptyField(input.accountId, "accountId", operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_bank_account", {
    target_organization_id: scopedOrganizationId,
    input_name: name,
    input_account_id: accountId,
    input_institution_name: input.institutionName ?? null,
    input_account_type: input.accountType ?? null,
    input_last_four: input.lastFour ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createBankAccount RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bank account creation returned no row",
    });
  }

  return result.data as BankAccountRow;
}

export async function createBankTransaction(
  organizationId: string,
  input: CreateBankTransactionInput,
): Promise<BankTransactionRow> {
  const operation = "createBankTransaction";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const bankAccountId = requireNonEmptyField(
    input.bankAccountId,
    "bankAccountId",
    operation,
  );
  const transactionDate = requireNonEmptyField(
    input.transactionDate,
    "transactionDate",
    operation,
  );
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_bank_transaction", {
    target_organization_id: scopedOrganizationId,
    input_bank_account_id: bankAccountId,
    input_transaction_date: transactionDate,
    input_amount: input.amount,
    input_description: input.description ?? null,
    input_transaction_type: input.transactionType ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createBankTransaction RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bank transaction creation returned no row",
    });
  }

  return result.data as BankTransactionRow;
}

export async function matchBankTransaction(
  organizationId: string,
  input: MatchBankTransactionInput,
): Promise<{ bankTransactionId: string; matchId: string }> {
  const operation = "matchBankTransaction";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const bankTransactionId = requireNonEmptyField(
    input.bankTransactionId,
    "bankTransactionId",
    operation,
  );
  const matchedSourceId = requireNonEmptyField(
    input.matchedSourceId,
    "matchedSourceId",
    operation,
  );
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("match_bank_transaction", {
    target_organization_id: scopedOrganizationId,
    input_bank_transaction_id: bankTransactionId,
    input_match_type: input.matchType,
    input_matched_source_id: matchedSourceId,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[matchBankTransaction RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Bank transaction match returned no row",
    });
  }

  const match = result.data as { id: string };

  return {
    bankTransactionId,
    matchId: match.id,
  };
}
