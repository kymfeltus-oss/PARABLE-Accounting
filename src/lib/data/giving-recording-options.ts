import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountRow } from "./types/rows";

export type GivingRecordingAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: "asset" | "liability" | "revenue";
  displayLabel: string;
};

type DebitAccountType = "asset" | "liability";

function resolveDebitAccountTypes(givingMethod: string | null): DebitAccountType[] {
  if (givingMethod == null) {
    return [];
  }

  switch (givingMethod.trim().toLowerCase()) {
    case "cash":
    case "check":
    case "ach":
      return ["asset"];
    case "card":
    case "other":
      return ["asset", "liability"];
    default:
      return [];
  }
}

function formatDisplayLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

function toRecordingAccountOption(
  account: AccountRow,
): GivingRecordingAccountOption | null {
  if (
    account.account_type !== "asset" &&
    account.account_type !== "liability" &&
    account.account_type !== "revenue"
  ) {
    return null;
  }

  return {
    id: account.id,
    code: account.code,
    name: account.name,
    accountType: account.account_type,
    displayLabel: formatDisplayLabel(account.code, account.name),
  };
}

function sortRecordingAccountOptions(
  options: GivingRecordingAccountOption[],
): GivingRecordingAccountOption[] {
  return [...options].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);

    if (codeCompare !== 0) {
      return codeCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

async function fetchActivePostingAccounts(
  organizationId: string,
  operation: string,
  accountTypes: string[],
): Promise<AccountRow[]> {
  if (accountTypes.length === 0) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_posting", true)
    .in("account_type", accountTypes)
    .order("code", { ascending: true })
    .order("name", { ascending: true });

  return unwrapRows<AccountRow>(`${operation}.accounts`, result);
}

export async function getGivingDebitAccountOptions(
  organizationId: string,
  givingMethod: string | null,
): Promise<GivingRecordingAccountOption[]> {
  const operation = "getGivingDebitAccountOptions";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const allowedAccountTypes = resolveDebitAccountTypes(givingMethod);

  if (allowedAccountTypes.length === 0) {
    return [];
  }

  const accounts = await fetchActivePostingAccounts(
    scopedOrganizationId,
    operation,
    allowedAccountTypes,
  );

  const options = accounts
    .filter((account) => account.organization_id === scopedOrganizationId)
    .filter((account) =>
      allowedAccountTypes.includes(account.account_type as DebitAccountType),
    )
    .map(toRecordingAccountOption)
    .filter(
      (option): option is GivingRecordingAccountOption =>
        option !== null && option.accountType !== "revenue",
    );

  return sortRecordingAccountOptions(options);
}

export async function getGivingRevenueAccountOptions(
  organizationId: string,
): Promise<GivingRecordingAccountOption[]> {
  const operation = "getGivingRevenueAccountOptions";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);

  const accounts = await fetchActivePostingAccounts(
    scopedOrganizationId,
    operation,
    ["revenue"],
  );

  const options = accounts
    .filter((account) => account.organization_id === scopedOrganizationId)
    .map(toRecordingAccountOption)
    .filter(
      (option): option is GivingRecordingAccountOption =>
        option !== null && option.accountType === "revenue",
    );

  return sortRecordingAccountOptions(options);
}
