"use client";

import { useCallback, useEffect, useState } from "react";
import { useMemberPortalSession } from "../MemberPortalSessionContext";
import { SOVEREIGN } from "../styles";

export function Stewardship() {
  const { supabase, tenantId, linkedMember } = useMemberPortalSession();
  const [ytd, setYtd] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenantId || !linkedMember) {
      setYtd(null);
      return;
    }
    setErr(null);
    const yStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("member_contributions")
      .select("amount, timestamp, status")
      .eq("tenant_id", tenantId)
      .eq("member_id", linkedMember.id)
      .eq("status", "SECURED")
      .gte("timestamp", yStart);
    if (error) {
      setErr(error.message);
      return;
    }
    const t = (data ?? []) as { amount: string }[];
    setYtd(t.reduce((a, b) => a + Math.abs(Number(b.amount) || 0), 0));
  }, [supabase, tenantId, linkedMember]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4 p-4 pb-24" style={{ background: SOVEREIGN.MATTE, minHeight: "60vh" }}>
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">My Stewardship</h2>
      <p className="text-xs text-white/45">YTD (calendar year) — member-safe view. Tax statements: export in production (PDF).</p>
      {err && <p className="text-xs text-amber-200/90">{err}</p>}
      {!linkedMember && <p className="text-sm text-white/50">Sign in or use Profile → Demo to preview.</p>}
      {linkedMember && ytd != null && (
        <div
          className="rounded-2xl border border-white/10 p-5"
          style={{ background: SOVEREIGN.DEEP, boxShadow: `0 0 0 1px color-mix(in srgb, ${SOVEREIGN.GLOW} 8%, transparent)` }}
        >
          <p className="text-[10px] font-bold uppercase text-white/40">YTD giving</p>
          <p className="mt-1 font-mono text-3xl" style={{ color: SOVEREIGN.GLOW }}>
            {ytd.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
          <p className="mt-2 text-xs text-white/45">Statement ready status: in-app (501(c)(3) name on file)</p>
        </div>
      )}
    </div>
  );
}
