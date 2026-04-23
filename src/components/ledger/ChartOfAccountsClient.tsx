"use client";

import { useCallback, useEffect, useState } from "react";
import ChartOfAccountsEditor from "@/components/ledger/ChartOfAccountsEditor";
import MinistryAppShell from "@/components/MinistryAppShell";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import type { CoAAccount } from "@/lib/coaUtils";

type CoaRow = CoAAccount & { tenant_id: string; created_at?: string };

function mapRow(r: {
  id: string;
  tenant_id: string;
  account_code: number;
  account_name: string;
  category: string;
  sub_category: string | null;
  is_restricted: boolean;
  parent_account_id: string | null;
}): CoAAccount {
  return {
    id: r.id,
    account_code: r.account_code,
    account_name: r.account_name,
    category: r.category,
    sub_category: r.sub_category,
    is_restricted: r.is_restricted,
    parent_account_id: r.parent_account_id,
  };
}

export default function ChartOfAccountsClient() {
  const supabase = getSupabaseBrowser();
  const { tenant, ready: brandReady, error: brandError } = useBrand();
  const [accounts, setAccounts] = useState<CoAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoading(false);
      setAccounts([]);
      if (brandReady) setErr(brandError ?? "Set tenant to load the chart of accounts.");
      return;
    }
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("chart_of_accounts")
      .select("id, tenant_id, account_code, account_name, category, sub_category, is_restricted, parent_account_id")
      .eq("tenant_id", tenant.id)
      .order("account_code", { ascending: true });
    if (error) {
      setErr(error.message);
      setAccounts([]);
    } else {
      setAccounts((data ?? []).map((r) => mapRow(r as CoaRow)));
    }
    setLoading(false);
  }, [supabase, tenant, brandReady, brandError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAddChild = useCallback(
    async (parent: CoAAccount, p: { account_name: string; account_code: number }) => {
      if (!supabase || !tenant?.id) return;
      setBusyId(parent.id);
      setErr(null);
      const { error } = await supabase
        .schema("parable_ledger")
        .from("chart_of_accounts")
        .insert({
          tenant_id: tenant.id,
          account_code: p.account_code,
          account_name: p.account_name,
          category: parent.category,
          sub_category: parent.sub_category ? `Sub: ${parent.sub_category}` : "Sub-account",
          is_restricted: parent.is_restricted,
          parent_account_id: parent.id,
        });
      if (error) {
        setErr(error.message);
        setBusyId(null);
        throw new Error(error.message);
      }
      await load();
      setBusyId(null);
    },
    [supabase, tenant, load]
  );

  const onAddRoot = useCallback(
    async (p: { account_name: string; account_code: number; category: string }) => {
      if (!supabase || !tenant?.id) return;
      setErr(null);
      const { error } = await supabase
        .schema("parable_ledger")
        .from("chart_of_accounts")
        .insert({
          tenant_id: tenant.id,
          account_code: p.account_code,
          account_name: p.account_name,
          category: p.category,
          sub_category: "Custom",
          is_restricted: false,
          parent_account_id: null,
        });
      if (error) {
        setErr(error.message);
        throw new Error(error.message);
      }
      await load();
    },
    [supabase, tenant, load]
  );

  return (
    <MinistryAppShell>
      <ChartOfAccountsEditor
        accounts={accounts}
        loading={loading}
        error={err}
        balanceByAccountId={null}
        onAddChild={onAddChild}
        onAddRoot={onAddRoot}
        busyId={busyId}
      />
    </MinistryAppShell>
  );
}
