"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SovereignSeal, { type SealTier } from "@/components/branding/SovereignSeal";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { applyTenantCssVars } from "@/lib/brandCss";
import { getComplianceStatus } from "@/lib/sealFromRoot.js";
import { sumUbiYtdForYear } from "@/lib/complianceFromRoot.js";
import type { TenantRow } from "@/types/tenant";

type MandateRow = { mandate_type: string; fiscal_year: number; status: string; board_approval_timestamp: string | null; updated_at: string };
type AlertRow = { id: string; violation_code: string; status: string; risk_level: string; created_at: string };
type FundRow = { id: string; fund_code: string; fund_name: string; is_restricted: boolean; balance: number };

type Props = { slug: string };

/**
 * Donor-facing, read-only stewardship + compliance summary.
 * No payroll detail; high-level fund health and filing rhythm only.
 */
export default function PublicVerification({ slug }: Props) {
  const supabase = getSupabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [tier, setTier] = useState<SealTier>("pending");
  const [sealReasons, setSealReasons] = useState<string[]>([]);
  const [missionsYtd, setMissionsYtd] = useState<number | null>(null);
  const [restrictedNarrative, setRestrictedNarrative] = useState<string>("—");
  const [mandates, setMandates] = useState<MandateRow[]>([]);
  const [yEnd] = useState(() => new Date().getUTCFullYear());

  const load = useCallback(async () => {
    if (!supabase) {
      setErr("This verification view requires a configured public API.");
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    const { data: t, error: te } = await supabase
      .schema("parable_ledger")
      .from("tenants")
      .select("id,slug,display_name,legal_name,primary_color,accent_color,logo_url,custom_domain,tax_id_ein,fiscal_year_start")
      .eq("slug", slug)
      .maybeSingle();
    if (te) {
      setErr(te.message);
      setLoading(false);
      return;
    }
    if (!t) {
      setErr("Church not found for this link.");
      setLoading(false);
      return;
    }
    const tenantId = t.id;
    if (typeof document !== "undefined") {
      applyTenantCssVars(document.documentElement, t.primary_color ?? "#22d3ee", t.accent_color ?? "#0a0a0a", "#00f2ff");
    }
    setTenant(t as TenantRow);

    const [fundsQ, txQ, manQ, alertQ] = await Promise.all([
      supabase.schema("parable_ledger").from("ministry_funds").select("id,fund_code,fund_name,is_restricted,balance").eq("tenant_id", tenantId),
      supabase
        .schema("parable_ledger")
        .from("transactions")
        .select("amount,tx_type,created_at,is_ubi,contribution_nature,metadata,fund_id,tenant_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .schema("parable_ledger")
        .from("compliance_mandates")
        .select("mandate_type,fiscal_year,status,board_approval_timestamp,updated_at")
        .eq("tenant_id", tenantId)
        .order("fiscal_year", { ascending: false })
        .limit(40),
      supabase
        .schema("parable_ledger")
        .from("compliance_violation_alerts")
        .select("id,violation_code,status,risk_level,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (fundsQ.error) setErr(fundsQ.error.message);
    if (manQ.error && !fundsQ.error) {
      setErr(`Mandate visibility: ${manQ.error.message} (apply latest migrations for public donor access.)`);
    }
    const funds = (fundsQ.data ?? []) as FundRow[];
    const txs = txQ.data ?? [];
    const mands = manQ.error ? [] : ((manQ.data ?? []) as MandateRow[]);
    setMandates(mands);

    const msn = funds.find((f) => f.fund_code === "MSN");
    if (msn) {
      let msum = 0;
      for (const row of txs) {
        if (row.fund_id === msn.id && row.tx_type === "expense") {
          msum += Math.abs(Number(row.amount ?? 0));
        }
      }
      setMissionsYtd(msum);
    } else {
      setMissionsYtd(0);
    }

    const restricted = funds.filter((f) => f.is_restricted && (Number(f.balance) > 0 || f.fund_code === "MSN" || f.fund_code === "BLD"));
    if (restricted.length) {
      setRestrictedNarrative(
        `${restricted.length} designated fund(s) active; balances are held in the ministry ledger with donor intent. (Figures are summarized — not audited financial statements.)`
      );
    } else {
      setRestrictedNarrative("No restricted-fund lines detected in the public summary.");
    }

    const housing = mands.find((m) => m.mandate_type === "HOUSING_ALLOWANCE" && m.fiscal_year === yEnd);
    const hasHousingResolution = Boolean(housing && housing.status !== "pending");
    const ubiTotal = sumUbiYtdForYear(txs, yEnd);
    const has990T = false;
    if (alertQ.error) {
      console.warn("[PublicVerification] alerts", alertQ.error.message);
    }
    const alerts = (alertQ.data ?? []) as AlertRow[];
    const seal = getComplianceStatus(
      alerts.map((a) => ({
        status: a.status,
        risk_level: a.risk_level,
        violation_code: a.violation_code,
        resolved: a.status === "resolved",
      })),
      { hasHousingResolution, ubiTotal, has990T },
      { tenantId, tenantSlug: slug, year: yEnd }
    );
    setTier(seal.tier === "platinum" ? "platinum" : seal.tier === "suspended" ? "suspended" : "pending");
    setSealReasons(seal.reasons ?? []);
    setLoading(false);
  }, [slug, supabase, yEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const display = tenant?.legal_name ?? tenant?.display_name ?? "This ministry";
  const primary = tenant?.primary_color ?? "#22d3ee";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-white/5 bg-black/30">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
          <p className="text-[9px] font-bold tracking-[0.4em] text-cyan-400/80">PARABLE · public verification</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{display}</h1>
          <p className="mt-1 text-sm text-zinc-500">Sovereign Seal — stewardship summary (non-financial-audit, read-only)</p>
        </div>
      </div>

      {loading && (
        <p className="p-8 text-sm text-zinc-500" role="status">
          Loading public profile…
        </p>
      )}
      {err && (
        <p className="p-8 text-sm text-red-400" role="alert">
          {err}
        </p>
      )}

      {!loading && !err && tenant && (
        <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr,240px] lg:items-center">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-400/90">Stewardship summary</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                This page is generated from the ministry&rsquo;s operations in PARABLE: Ledger. It omits individual payroll, banking, and
                PII. Amounts are directional; refer to the church&rsquo;s audited or reviewed statements for formal reporting.
              </p>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 border-b border-zinc-800/80 py-2">
                  <dt className="text-zinc-500">Missions (expense through designated fund)</dt>
                  <dd className="font-mono text-cyan-200/90">
                    {missionsYtd == null
                      ? "—"
                      : missionsYtd.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </dd>
                </div>
                <div className="py-2">
                  <dt className="text-zinc-500">Designated (restricted) fund posture</dt>
                  <dd className="mt-1 text-zinc-300">{restrictedNarrative}</dd>
                </div>
              </dl>
            </div>

            <motion.div
              className="mx-auto"
              initial={{ scale: 0.35, opacity: 0.2, filter: "blur(8px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ type: "spring", stiffness: 120, damping: 14, mass: 0.8 }}
            >
              <SovereignSeal tier={tier} primaryColor={primary} className="w-full max-w-[220px]" />
              <p className="mt-2 text-center text-[9px] text-zinc-500">
                Seal state: <span className="text-zinc-300 uppercase">{tier}</span>
              </p>
            </motion.div>
          </div>

          {sealReasons.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-100/90">
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-200/80">Active integrity notes</p>
              <ul className="mt-2 list-inside list-disc text-zinc-300">
                {sealReasons.map((r) => (
                  <li key={r.slice(0, 40)}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <section>
            <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-400/90">Board &amp; compliance log (dates only)</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-[9px] font-bold uppercase text-zinc-500">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2">Year</th>
                    <th className="p-2">State</th>
                    <th className="p-2">Last update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                  {mandates.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-zinc-500">
                        No public mandate records yet.
                      </td>
                    </tr>
                  )}
                  {mandates.map((m) => (
                    <tr key={`${m.mandate_type}-${m.fiscal_year}`}>
                      <td className="p-2 font-mono text-cyan-200/80">{m.mandate_type.replace(/_/g, " ")}</td>
                      <td className="p-2">{m.fiscal_year}</td>
                      <td className="p-2">{m.status}</td>
                      <td className="p-2 text-zinc-500">{m.board_approval_timestamp?.slice(0, 10) ?? m.updated_at?.slice(0, 10) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              <span className="text-zinc-400">Form 941 (payroll) &amp; 990/990-T:</span> Wage and tax line items are never published here. The church&rsquo;s
              team manages filings inside PARABLE; use IRS transcripts for definitive proof. This page is a high-level integrity signal only.
            </p>
          </section>

          <footer className="border-t border-zinc-800/80 pt-6 text-center text-[10px] text-zinc-500">
            <p>
              Powered by <span className="text-cyan-500/90">PARABLE: Ledger</span> — full-stack governance and compliance, not a substitute
              for independent audit or legal counsel.
            </p>
            <p className="mt-2">
              <Link className="text-cyan-400/90 underline" href="/">
                Product home
              </Link>
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
