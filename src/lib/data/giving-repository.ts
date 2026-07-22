import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import {
  getMonthDateRange,
  getYearToDateRange,
  sumAmounts,
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
