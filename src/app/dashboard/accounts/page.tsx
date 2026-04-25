import type { Metadata } from "next";
import MasterCoaAccounts, { type CoaListRow } from "@/components/dashboard/MasterCoaAccounts";
import { getSupabaseServerAnon } from "@/lib/supabase/server-anon";
import { PARABLE_DEFAULT_TENANT_SLUG } from "@sovereign/supabaseClient.js";

export const metadata: Metadata = {
  title: "Master COA",
  description: "Institutional chart of accounts: searchable master ledger and fund categories.",
};

export const dynamic = "force-dynamic";

export default async function DashboardAccountsPage() {
  const supabase = getSupabaseServerAnon();
  if (!supabase) {
    return <MasterCoaAccounts tenantLabel="—" accounts={[]} error="Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)." />;
  }

  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || PARABLE_DEFAULT_TENANT_SLUG;
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, display_name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (tErr) {
    return <MasterCoaAccounts tenantLabel={slug} accounts={[]} error={tErr.message} />;
  }
  if (!tenant) {
    return (
      <MasterCoaAccounts
        tenantLabel={slug}
        accounts={[]}
        error={`No tenant for slug “${slug}”. Set NEXT_PUBLIC_TENANT_SLUG or seed parable_ledger.tenants.`}
      />
    );
  }

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, account_code, account_name, category, sub_category, account_type, is_restricted")
    .eq("tenant_id", (tenant as { id: string }).id)
    .order("account_code", { ascending: true });

  if (error) {
    return <MasterCoaAccounts tenantLabel={(tenant as { display_name: string }).display_name} accounts={[]} error={error.message} />;
  }

  const accounts = (data ?? []) as CoaListRow[];
  const label = (tenant as { display_name: string; slug: string }).display_name || (tenant as { slug: string }).slug;

  return <MasterCoaAccounts tenantLabel={label} accounts={accounts} error={null} />;
}
