import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountRow } from "./types/rows";

export type ExpenseCreditAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: "asset" | "liability";
  displayLabel: string;
};

type CreditAccountType = ExpenseCreditAccountOption["accountType"];

const DISALLOWED_ACCOUNT_TYPES = new Set(["revenue", "expense", "net_asset"]);

function resolveAllowedAccountTypes(
  paymentSource: string | null,
): CreditAccountType[] {
  if (paymentSource == null) {
    return [];
  }

  switch (paymentSource.trim().toLowerCase()) {
    case "bank":
    case "cash":
      return ["asset"];
    case "card":
    case "reimbursement":
      return ["liability"];
    default:
      return [];
  }
}

function formatDisplayLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

function toCreditAccountOption(account: AccountRow): ExpenseCreditAccountOption | null {
  if (account.account_type !== "asset" && account.account_type !== "liability") {
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

function sortCreditAccountOptions(
  options: ExpenseCreditAccountOption[],
): ExpenseCreditAccountOption[] {
  return [...options].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);

    if (codeCompare !== 0) {
      return codeCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

export async function getExpenseCreditAccountOptions(
  organizationId: string,
  paymentSource: string | null,
): Promise<ExpenseCreditAccountOption[]> {
  const operation = "getExpenseCreditAccountOptions";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const allowedAccountTypes = resolveAllowedAccountTypes(paymentSource);

  if (allowedAccountTypes.length === 0) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .eq("status", "active")
    .eq("is_posting", true)
    .in("account_type", allowedAccountTypes)
    .order("code", { ascending: true })
    .order("name", { ascending: true });

  const accounts = unwrapRows<AccountRow>(`${operation}.accounts`, result);

  const options = accounts
    .filter((account) => account.organization_id === scopedOrganizationId)
    .filter((account) =>
      allowedAccountTypes.includes(account.account_type as CreditAccountType),
    )
    .filter((account) => !DISALLOWED_ACCOUNT_TYPES.has(account.account_type))
    .map(toCreditAccountOption)
    .filter((option): option is ExpenseCreditAccountOption => option !== null);

  return sortCreditAccountOptions(options);
}
