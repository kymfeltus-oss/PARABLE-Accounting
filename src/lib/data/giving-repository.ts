import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import {
  getMonthDateRange,
  getYearToDateRange,
  sumAmounts,
  toDataAccessError,
  unwrapRows,
} from "./query-helpers";
import type {
  AmountRow,
  FundRow,
  GivingTransactionRow,
} from "./types/rows";

export type GivingData = {
  organizationId: string;
  transactions: GivingTransactionRow[];
  funds: FundRow[];
  summary: {
    givingThisMonth: number;
    yearToDateGiving: number;
    transactionCount: number;
    activeGiverCount: number;
  };
};

export type RecordedGivingTransactionRow = GivingTransactionRow & {
  journal_entry_id: string | null;
};

function requireGivingTransactionId(
  givingTransactionId: string,
  operation: string,
): string {
  const trimmed = givingTransactionId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "givingTransactionId is required and must be a non-empty string",
    });
  }

  return trimmed;
}

export async function getGivingData(
  organizationId: string,
): Promise<GivingData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getGivingData",
  );
  const supabase = await createServerSupabaseClient();
  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange();
  const { startDate: yearStart, endDate: yearEnd } = getYearToDateRange();

  const [
    transactionsResult,
    fundsResult,
    givingThisMonthResult,
    yearToDateResult,
    activeGiversResult,
  ] = await Promise.all([
    supabase
      .from("giving_transactions")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("funds")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .order("name", { ascending: true }),
    supabase
      .from("giving_transactions")
      .select("amount")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "recorded")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd),
    supabase
      .from("giving_transactions")
      .select("amount")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "recorded")
      .gte("transaction_date", yearStart)
      .lte("transaction_date", yearEnd),
    supabase
      .from("giving_transactions")
      .select("member_id")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "recorded")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .not("member_id", "is", null),
  ]);

  const transactions = unwrapRows<GivingTransactionRow>(
    "getGivingData.transactions",
    transactionsResult,
  );
  const funds = unwrapRows<FundRow>("getGivingData.funds", fundsResult);
  const givingThisMonth = sumAmounts(
    unwrapRows<AmountRow>(
      "getGivingData.givingThisMonth",
      givingThisMonthResult,
    ),
  );
  const yearToDateGiving = sumAmounts(
    unwrapRows<AmountRow>("getGivingData.yearToDateGiving", yearToDateResult),
  );
  const activeGiverRows = unwrapRows<{ member_id: string | null }>(
    "getGivingData.activeGivers",
    activeGiversResult,
  );
  const activeGiverCount = new Set(
    activeGiverRows
      .map((row) => row.member_id)
      .filter((memberId): memberId is string => memberId !== null),
  ).size;

  return {
    organizationId: scopedOrganizationId,
    transactions,
    funds,
    summary: {
      givingThisMonth,
      yearToDateGiving,
      transactionCount: transactions.length,
      activeGiverCount,
    },
  };
}

export async function recordGiving(
  organizationId: string,
  givingTransactionId: string,
  debitAccountId: string,
  creditAccountId: string,
): Promise<RecordedGivingTransactionRow> {
  const operation = "recordGiving";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedGivingTransactionId = requireGivingTransactionId(
    givingTransactionId,
    operation,
  );
  const scopedDebitAccountId = debitAccountId.trim();
  const scopedCreditAccountId = creditAccountId.trim();

  if (!scopedDebitAccountId) {
    throw new DataAccessError({
      operation,
      message: "debitAccountId is required and must be a non-empty string",
    });
  }

  if (!scopedCreditAccountId) {
    throw new DataAccessError({
      operation,
      message: "creditAccountId is required and must be a non-empty string",
    });
  }

  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("record_giving", {
    target_organization_id: scopedOrganizationId,
    target_giving_transaction_id: scopedGivingTransactionId,
    input_debit_account_id: scopedDebitAccountId,
    input_credit_account_id: scopedCreditAccountId,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[recordGiving RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        organizationId: scopedOrganizationId,
        givingTransactionId: scopedGivingTransactionId,
        debitAccountId: scopedDebitAccountId,
        creditAccountId: scopedCreditAccountId,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Giving recording returned no row",
    });
  }

  return result.data as RecordedGivingTransactionRow;
}
