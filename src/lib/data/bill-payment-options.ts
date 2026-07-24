import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountRow } from "./types/rows";

export type BillCashAccountOption = {
  id: string;
  code: string;
  name: string;
  label: string;
};

function formatAccountLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

export function mapBillCashAccountOptions(
  accounts: AccountRow[],
): BillCashAccountOption[] {
  return accounts
    .filter(
      (account) =>
        account.account_type === "asset" &&
        account.status === "active" &&
        account.is_posting,
    )
    .map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      label: formatAccountLabel(account.code, account.name),
    }));
}

export async function getBillCashAccountOptions(
  organizationId: string,
): Promise<BillCashAccountOption[]> {
  const operation = "getBillCashAccountOptions";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", scopedOrganizationId)
    .eq("status", "active")
    .eq("is_posting", true)
    .eq("account_type", "asset")
    .order("code", { ascending: true })
    .order("name", { ascending: true });

  const accounts = unwrapRows<AccountRow>(`${operation}.accounts`, result);

  return mapBillCashAccountOptions(
    accounts.filter((account) => account.organization_id === scopedOrganizationId),
  );
}
