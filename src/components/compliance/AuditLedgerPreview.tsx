"use client";

import { useBrand } from "@/components/branding/BrandProvider";
import { startTransition, useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { sanitizeLedgerMetadataForAudit } from "@/lib/sanitizeLedgerMetadata";

type TxRow = {
  id: string;
  tenant_id?: string;
  created_at: string;
  amount: number;
  irs_category: string | null;
  audit_flag: boolean | null;
  fund_id: string;
  metadata: Record<string, unknown> | null;
};

export default function AuditLedgerPreview() {
  const supabase = getSupabaseBrowser();
  const { tenant } = useBrand();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      startTransition(() => setErr("Configure Supabase env to load ledger rows."));
      return;
    }
    if (!tenant?.id) {
      startTransition(() => setErr("Tenant not loaded — run white_label_schema.sql and set NEXT_PUBLIC_TENANT_SLUG."));
      return;
    }
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("transactions")
      .select("id,created_at,amount,irs_category,audit_flag,fund_id,metadata")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(40);
    startTransition(() => {
      if (error) setErr(error.message);
      else setRows((data ?? []) as TxRow[]);
    });
  }, [supabase, tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-neutral-300 bg-white p-6 text-neutral-900 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-600">Ledger — audit columns only</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Streaming / hype metadata keys are hidden. Full row JSON is still in the database for operational use.
      </p>
      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-300 text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">IRS category</th>
              <th className="py-2 pr-3">Fund</th>
              <th className="py-2 pr-3">Audit</th>
              <th className="py-2">Core metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const fund = r.fund_id.slice(0, 8) + "…";
              const meta = sanitizeLedgerMetadataForAudit(r.metadata);
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "—";
              return (
                <tr key={r.id} className="border-b border-neutral-200 align-top">
                  <td className="py-2 pr-3 font-mono text-neutral-800">{r.created_at?.slice(0, 10)}</td>
                  <td className="py-2 pr-3 font-mono text-neutral-900">${Number(r.amount).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-neutral-800">{r.irs_category ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-800">{fund}</td>
                  <td className="py-2 pr-3">
                    {r.audit_flag ? (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-600/40 bg-amber-50 px-2 py-0.5 text-amber-900">
                        <span className="font-bold" aria-hidden>
                          !
                        </span>
                        Review
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate py-2 font-mono text-[10px] text-neutral-600" title={metaStr}>
                    {metaStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !err ? (
          <p className="mt-4 text-sm text-neutral-500">No rows returned (empty ledger or RLS).</p>
        ) : null}
      </div>
    </section>
  );
}
