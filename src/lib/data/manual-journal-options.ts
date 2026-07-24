import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountRow, AccountingPeriodRow, FundRow } from "./types/rows";

export type ManualJournalAccountOption = {
  id: string;
  code: string;
  name: string;
};

export type ManualJournalFundOption = {
  id: string;
  code: string;
  name: string;
};

export type ManualJournalPeriodOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

export type ManualJournalOptions = {
  accounts: ManualJournalAccountOption[];
  funds: ManualJournalFundOption[];
  periods: ManualJournalPeriodOption[];
};

function sortAccounts(
  accounts: ManualJournalAccountOption[],
): ManualJournalAccountOption[] {
  return [...accounts].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);

    if (codeCompare !== 0) {
      return codeCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortFunds(funds: ManualJournalFundOption[]): ManualJournalFundOption[] {
  return [...funds].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);

    if (codeCompare !== 0) {
      return codeCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortPeriods(
  periods: ManualJournalPeriodOption[],
): ManualJournalPeriodOption[] {
  return [...periods].sort((left, right) => {
    const startCompare = left.startDate.localeCompare(right.startDate);

    if (startCompare !== 0) {
      return startCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

function toAccountOption(account: AccountRow): ManualJournalAccountOption {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
  };
}

function toFundOption(fund: FundRow): ManualJournalFundOption {
  return {
    id: fund.id,
    code: fund.code ?? "",
    name: fund.name,
  };
}

function toPeriodOption(
  period: AccountingPeriodRow,
): ManualJournalPeriodOption {
  return {
    id: period.id,
    name: period.name,
    startDate: period.start_date,
    endDate: period.end_date,
    isOpen: period.status === "open",
  };
}

export async function getManualJournalOptions(
  organizationId: string,
): Promise<ManualJournalOptions> {
  const operation = "getManualJournalOptions";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const [accountsResult, fundsResult, periodsResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "active")
      .eq("is_posting", true)
      .order("code", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("funds")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "active")
      .order("code", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("accounting_periods")
      .select("*")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "open")
      .order("start_date", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const accounts = unwrapRows<AccountRow>(`${operation}.accounts`, accountsResult);
  const funds = unwrapRows<FundRow>(`${operation}.funds`, fundsResult);
  const periods = unwrapRows<AccountingPeriodRow>(
    `${operation}.periods`,
    periodsResult,
  );

  return {
    accounts: sortAccounts(
      accounts
        .filter((account) => account.organization_id === scopedOrganizationId)
        .map(toAccountOption),
    ),
    funds: sortFunds(
      funds
        .filter((fund) => fund.organization_id === scopedOrganizationId)
        .map(toFundOption),
    ),
    periods: sortPeriods(
      periods
        .filter((period) => period.organization_id === scopedOrganizationId)
        .map(toPeriodOption),
    ),
  };
}
