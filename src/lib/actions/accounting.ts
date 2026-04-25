"use server";

import { revalidatePath } from "next/cache";
import { PARABLE_DEFAULT_TENANT_SLUG } from "@sovereign/supabaseClient.js";
import { createServerSupabase } from "@/lib/supabase/server-cookies";

const COA_CATEGORIES = ["Asset", "Liability", "Net Asset", "Income", "Expense"] as const;
type CoaCategory = (typeof COA_CATEGORIES)[number];

function isCoaCategory(s: string): s is CoaCategory {
  return (COA_CATEGORIES as readonly string[]).includes(s);
}

function accountTypeForCategory(category: CoaCategory): string {
  switch (category) {
    case "Asset":
      return "ASSET";
    case "Liability":
      return "LIABILITY";
    case "Net Asset":
      return "NET_ASSET";
    case "Income":
      return "INCOME";
    case "Expense":
      return "EXPENSE";
    default:
      return "OPERATING";
  }
}

function str(v: FormDataEntryValue | null): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : String(v).trim();
}

/**
 * Resolves current tenant (same as dashboard COA) for inserts.
 */
async function resolveTenantId(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || PARABLE_DEFAULT_TENANT_SLUG;
  const { data, error } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error(`No tenant for slug “${slug}”.`);
  return data.id as string;
}

/**
 * Inserts a row into `parable_ledger.chart_of_accounts`.
 * The database has no `normal_balance` column; category encodes reporting (and normal is implied).
 */
export async function addAccount(formData: FormData) {
  const supabase = await createServerSupabase();
  const tenantId = await resolveTenantId(supabase);

  const codeRaw = str(formData.get("account_code"));
  const account_name = str(formData.get("account_name"));
  const account_type_in = str(formData.get("account_type"));
  const categoryRaw = str(formData.get("category"));
  const normalBalance = str(formData.get("normal_balance"));

  const account_code = parseInt(codeRaw, 10);
  if (Number.isNaN(account_code)) {
    throw new Error("Account code must be a number");
  }
  if (!account_name) {
    throw new Error("Account name is required");
  }
  if (!isCoaCategory(categoryRaw)) {
    throw new Error(`Category must be one of: ${COA_CATEGORIES.join(", ")}`);
  }
  const category = categoryRaw;

  if (normalBalance) {
    const wantDebit = category === "Asset" || category === "Expense";
    const isDebit = normalBalance === "debit";
    if (wantDebit !== isDebit) {
      throw new Error(
        "Normal balance does not match category: Asset & Expense are debit-normal; Liability, Net Asset, and Income are credit-normal.",
      );
    }
  }

  const account_type =
    account_type_in && account_type_in.length > 0
      ? account_type_in
      : accountTypeForCategory(category);

  const { error } = await supabase.from("chart_of_accounts").insert({
    tenant_id: tenantId,
    account_code,
    account_name,
    account_type,
    category,
    sub_category: "Manual entry",
    is_restricted: false,
    parent_account_id: null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/accounts");
}
