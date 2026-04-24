"use client";

import { useCallback, useEffect, useState } from "react";
import { useMemberPortalSession } from "../MemberPortalSessionContext";
import { useBrand } from "@/components/branding/BrandProvider";
import { SOVEREIGN } from "../styles";

export function FundTrackers() {
  const { supabase, tenantId } = useMemberPortalSession();
  const { tenant } = useBrand();
  const [name, setName] = useState("Project Building Fund");
  const [pct, setPct] = useState(42);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenantId) return;
    const { data: funds, error: fErr } = await supabase
      .schema("parable_ledger")
      .from("ministry_funds")
      .select("fund_name, balance, fund_code")
      .eq("tenant_id", tenantId)
      .eq("fund_code", "BLD")
      .maybeSingle();
    if (fErr) {
      setErr(fErr.message);
      return;
    }
    if (funds) {
      setName((funds as { fund_name: string }).fund_name || name);
    }
    const { data: projects } = await supabase
      .schema("parable_ledger")
      .from("capex_projects")
      .select("name, budget, status")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "paused"])
      .limit(1)
      .maybeSingle();
    if (projects) {
      const p = projects as { name?: string; budget: string; status: string };
      if (p.budget) {
        const b = Math.max(1, Number(p.budget) || 1);
        const bl = (funds as { balance?: string } | null)?.balance;
        const paid = Math.max(0, Math.min(b, bl ? Math.abs(Number(bl) || 0) : 0));
        setPct(Math.min(100, Math.round((paid / b) * 100)));
        if (p.name) setName(p.name);
      }
    }
  }, [supabase, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4 p-4 pb-24" style={{ background: SOVEREIGN.MATTE, minHeight: "60vh" }}>
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">Fund track</h2>
      {tenant?.legal_name && <p className="text-xs text-white/40">{tenant.legal_name}</p>}
      {err && <p className="text-amber-200/80">{err}</p>}
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: `color-mix(in srgb, ${SOVEREIGN.GLOW} 25%, #333)` }}
      >
        <p className="text-sm font-bold text-white/90">{name}</p>
        <p className="text-[9px] uppercase text-white/35">Building (restricted) · visual goal</p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-950">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, ${SOVEREIGN.GLOW} 55%, #0ff), #4ade80)`,
              boxShadow: `0 0 20px color-mix(in srgb, ${SOVEREIGN.GLOW} 20%, transparent)`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-white/50">{pct}% to stated goal (modeled on fund + capex)</p>
      </div>
    </div>
  );
}
