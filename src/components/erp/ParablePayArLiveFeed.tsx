"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";

type Row = {
  id: string;
  amount: number;
  fund_id: string;
  timestamp: string;
  gl_journal_entry_id: string | null;
  member_id: string;
  memberName: string;
};

/**
 * Parable Pay → member_contributions: shows recent SECURED posts (AR / cash inflow) and subscribes to new inserts.
 */
export default function ParablePayArLiveFeed({ tenantId }: { tenantId: string | null | undefined }) {
  const supabase = getSupabaseBrowser();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenantId) {
      setRows([]);
      return;
    }
    setErr(null);
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("member_contributions")
      .select("id, amount, fund_id, timestamp, gl_journal_entry_id, member_id")
      .eq("tenant_id", tenantId)
      .order("timestamp", { ascending: false })
      .limit(20);
    if (error) {
      setErr(error.message);
      return;
    }
    const list = (data ?? []) as {
      id: string;
      amount: string | number;
      fund_id: string;
      timestamp: string;
      gl_journal_entry_id: string | null;
      member_id: string;
    }[];
    const mIds = Array.from(new Set(list.map((r) => r.member_id)));
    const nameById: Record<string, string> = {};
    if (mIds.length) {
      const { data: mems } = await supabase
        .schema("parable_ledger")
        .from("congregation_members")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .in("id", mIds);
      for (const m of (mems ?? []) as { id: string; full_name: string }[]) {
        nameById[m.id] = m.full_name;
      }
    }
    setRows(
      list.map((r) => ({
        id: r.id,
        amount: Math.abs(Number(r.amount) || 0),
        fund_id: r.fund_id,
        timestamp: r.timestamp,
        gl_journal_entry_id: r.gl_journal_entry_id,
        member_id: r.member_id,
        memberName: nameById[r.member_id] || "Member",
      }))
    );
  }, [supabase, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !tenantId) return;
    const ch = supabase
      .channel(`ar-pp-contrib-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "parable_ledger", table: "member_contributions", filter: `tenant_id=eq.${tenantId}` },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, tenantId, load]);

  if (!tenantId) return null;

  return (
    <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-black/30 p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-200/80">Parable Pay — live feed</p>
      <p className="mt-0.5 text-[10px] text-zinc-500">Inserts to member_contributions (SECURED) with Dr 1010 / Cr 4010 on post.</p>
      {err && <p className="mt-2 text-xs text-amber-200/90">{err}</p>}
      <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-0.5 text-left">
        {rows.length === 0 && !err ? <li className="text-xs text-zinc-500">No Parable Pay rows yet — give from /giving.</li> : null}
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-white/5 bg-zinc-950/60 px-2 py-1.5 text-xs"
          >
            <span className="min-w-0 text-white/85">
              <span className="font-medium text-cyan-200/90">{r.memberName}</span>
              <span className="text-zinc-500"> · {r.fund_id}</span>
            </span>
            <span className="font-mono text-white/90">${r.amount.toFixed(2)}</span>
            <span className="w-full text-[9px] text-zinc-500 sm:w-auto sm:text-right">
              {new Date(r.timestamp).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
              {r.gl_journal_entry_id ? (
                <span className="ml-2 text-emerald-400/90" title="GL journal entry (double-entry posted)">
                  GL ✓
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
