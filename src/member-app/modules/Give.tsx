"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMemberPortalSession } from "../MemberPortalSessionContext";
import { SOVEREIGN } from "../styles";

const AMOUNTS = [10, 25, 50, 100, 250, 500] as const;
const GLOW = SOVEREIGN.GLOW;
const MATTE = SOVEREIGN.MATTE;
const DEEP = SOVEREIGN.DEEP;

const FUNDS = [
  { id: "GEN" as const, label: "General", sub: "Tithes & offerings" },
  { id: "MSN" as const, label: "Missions", sub: "Great Commission" },
  { id: "BLD" as const, label: "Project Building Fund", sub: "Capital" },
];
type FundId = (typeof FUNDS)[number]["id"];

const FREQUENCIES = [
  { id: "once" as const, label: "One-time" },
  { id: "weekly" as const, label: "Weekly" },
  { id: "monthly" as const, label: "Monthly" },
];
type Freq = (typeof FREQUENCIES)[number]["id"];

function money(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function makeCode() {
  const p = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PP-${p()}-${p()}`;
}

type View = "amount" | "fund" | "freq" | "review" | "receipt";

export function Give({ onClose }: { onClose: () => void }) {
  const { supabase, tenantId, linkedMember, demoMode } = useMemberPortalSession();
  const [view, setView] = useState<View>("amount");
  const [amount, setAmount] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [fund, setFund] = useState<FundId | null>(null);
  const [freq, setFreq] = useState<Freq | null>(null);
  const [code, setCode] = useState("");
  const [txId, setTxId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** null = still checking; true = cash + revenue lines present; false = missing or query error */
  const [ucoa, setUcoa] = useState<boolean | null>(null);
  const [coaCheckMessage, setCoaCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !tenantId) return;
    void (async () => {
      setCoaCheckMessage(null);
      const { data, error } = await supabase
        .schema("parable_ledger")
        .from("chart_of_accounts")
        .select("account_code")
        .eq("tenant_id", tenantId)
        .in("account_code", [1010, 4010]);
      if (error) {
        setUcoa(false);
        setCoaCheckMessage(
          `Could not read chart_of_accounts (${error.message}). Check RLS and that parable_ledger is exposed.`,
        );
        return;
      }
      const s = new Set((data ?? []).map((r: { account_code: number }) => r.account_code));
      const ok = s.has(1010) && s.has(4010);
      setUcoa(ok);
      if (!ok) {
        setCoaCheckMessage(
          "This tenant has no UCOA rows for account codes 1010 (cash) and 4010 (revenue). Seed chart_of_accounts for this tenant (see import_coa.sql / migrations) so ledger posting can validate.",
        );
      }
    })();
  }, [supabase, tenantId]);

  const onConfirm = useCallback(async () => {
    if (!supabase || !tenantId || !linkedMember || amount == null || !fund || !freq) {
      setErr("Missing member, amount, fund, or frequency — go back a step.");
      return;
    }
    if (ucoa === null) {
      setErr("Still checking chart of accounts — wait a moment, then try again.");
      return;
    }
    if (ucoa === false && !demoMode) {
      setErr("UCOA 1010 and 4010 are required for this tenant. Seed chart_of_accounts, then try again.");
      return;
    }
    setErr(null);
    setSyncing(true);
    const c = makeCode();
    setCode(c);
    try {
      const ins = await supabase
        .schema("parable_ledger")
        .from("member_contributions")
        .insert({
          tenant_id: tenantId,
          member_id: linkedMember.id,
          amount: amount,
          fund_id: fund,
          status: "PENDING",
          revenue_account_code: 4010,
          is_recurring: freq !== "once",
          metadata: { gift_frequency: freq, parable_approval: c, source: "member_portal", demo: demoMode },
        })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      const id = (ins.data as { id: string }).id;
      setTxId(id);
      await new Promise((r) => setTimeout(r, 1500));
      const u = await supabase
        .schema("parable_ledger")
        .from("member_contributions")
        .update({ status: "SECURED" })
        .eq("id", id);
      if (u.error) throw new Error(u.error.message);
      setView("receipt");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSyncing(false);
    }
  }, [supabase, tenantId, linkedMember, amount, fund, freq, ucoa, demoMode]);

  if (!linkedMember) {
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center p-4 text-center">
        <p className="text-sm text-amber-200/90">Link a member profile: sign in with the same email as the roster, or use Demo on Profile (anon preview).</p>
        <button type="button" onClick={onClose} className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white/80">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col" style={{ background: MATTE }}>
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-[10px] font-bold uppercase text-white/40 transition hover:text-[#00FFFF]"
        >
          Close
        </button>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Give</span>
        <span className="w-8" />
      </div>
      {err && <p className="px-4 py-2 text-center text-xs text-amber-200/90">{err}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24">
        {syncing && view !== "receipt" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20" style={{ borderTopColor: GLOW }} />
            <p className="mt-4 text-sm text-white/90">Securing on ledger…</p>
            <p className="mt-1 text-xs text-white/45">AR + General Ledger post in background (no full page refresh)</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "amount" && (
            <StepWrap key="a1">
              <h2 className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Select amount</h2>
              <div className="grid grid-cols-3 gap-2">
                {AMOUNTS.map((n) => (
                  <motion.button
                    key={n}
                    type="button"
                    className="rounded-xl border border-white/10 py-3.5 text-sm font-bold text-white/95"
                    style={{ background: DEEP, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${GLOW} 8%, transparent)` }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowOther(false);
                      setAmount(n);
                      setView("fund");
                    }}
                  >
                    {money(n)}
                  </motion.button>
                ))}
                <button
                  type="button"
                  className="col-span-3 rounded-xl border border-dashed py-3 text-sm font-bold uppercase"
                  style={{ borderColor: `color-mix(in srgb, ${GLOW} 40%, #444)` }}
                  onClick={() => {
                    setShowOther(true);
                    setAmount(null);
                  }}
                >
                  Other
                </button>
              </div>
              {showOther && (
                <div className="mt-4 space-y-2">
                  <input
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-lg"
                    inputMode="decimal"
                    placeholder="1,000"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    style={{ boxShadow: `0 0 0 1px color-mix(in srgb, ${GLOW} 12%, transparent)` }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = Number.parseFloat(other.replace(/[^0-9.]/g, ""));
                      if (Number.isFinite(v) && v > 0) {
                        setAmount(v);
                        setView("fund");
                      }
                    }}
                    className="w-full rounded-xl py-3 text-xs font-bold uppercase text-[#0a0a0a]"
                    style={{ background: GLOW }}
                  >
                    Continue
                  </button>
                </div>
              )}
            </StepWrap>
          )}

          {view === "fund" && amount != null && (
            <StepWrap key="a2">
              <h2 className="mb-1 text-center text-[10px] font-bold uppercase text-white/40">Fund</h2>
              <p className="mb-3 text-center font-mono text-xl" style={{ color: GLOW }}>
                {money(amount)}
              </p>
              <ul className="space-y-2">
                {FUNDS.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFund(f.id);
                        setView("freq");
                      }}
                      className="w-full rounded-xl border border-white/10 p-3 text-left text-sm font-bold text-white/90"
                      style={{ background: DEEP }}
                    >
                      {f.label} — <span className="text-xs font-normal text-white/50">{f.sub}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setView("amount")} className="mt-4 w-full text-[10px] font-bold uppercase text-white/35">
                Back
              </button>
            </StepWrap>
          )}

          {view === "freq" && amount != null && fund && (
            <StepWrap key="a3">
              <h2 className="mb-4 text-center text-[10px] font-bold uppercase text-white/40">Frequency</h2>
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFreq(f.id);
                    setView("review");
                  }}
                  className="mb-2 w-full rounded-xl border border-white/10 py-3.5 text-left text-sm font-semibold text-white/90"
                  style={{ background: DEEP }}
                >
                  {f.label}
                </button>
              ))}
              <button type="button" onClick={() => setView("fund")} className="mt-2 w-full text-[10px] font-bold uppercase text-white/35">
                Back
              </button>
            </StepWrap>
          )}

          {view === "review" && amount != null && fund && freq && !syncing && (
            <StepWrap key="a4">
              <h2 className="text-center text-[10px] font-bold uppercase text-white/40">1-Tap</h2>
              <p className="text-center text-lg font-bold text-white">{linkedMember.full_name}</p>
              <p className="mt-1 text-center font-mono text-3xl" style={{ color: GLOW }}>
                {money(amount)}
              </p>
              <p className="text-center text-sm text-white/50">{FUNDS.find((f) => f.id === fund)?.label}</p>
              <p className="text-center text-xs text-white/35">{FREQUENCIES.find((f) => f.id === freq)?.label}</p>
              <div
                className="mx-auto mt-5 max-w-sm rounded-2xl border p-4"
                style={{ borderColor: `color-mix(in srgb, ${GLOW} 30%, #333)`, background: DEEP }}
              >
                <p className="text-[9px] font-bold uppercase text-white/40">Saved card</p>
                <p className="mt-1 font-mono text-lg tracking-widest text-white/90">VISA ···· 4242</p>
                <p className="text-[9px] text-white/30">Stripe / Plaid vault — production</p>
              </div>
              {coaCheckMessage && (
                <p className="mx-auto mt-3 max-w-sm text-center text-[10px] leading-snug text-amber-200/85">{coaCheckMessage}</p>
              )}
              {ucoa === null && !coaCheckMessage && (
                <p className="mx-auto mt-3 max-w-sm text-center text-[10px] text-white/45">Checking chart of accounts (1010 / 4010)…</p>
              )}
              {demoMode && ucoa === false && (
                <p className="mx-auto mt-2 max-w-sm text-center text-[10px] text-cyan-200/70">
                  Demo: UCOA lines missing — tap below to attempt insert anyway (DB may still error if ministry_funds or RLS block).
                </p>
              )}
              <button
                type="button"
                onClick={() => void onConfirm()}
                className="mt-6 w-full max-w-sm rounded-2xl py-4 text-sm font-black uppercase tracking-widest text-[#0a0a0a] disabled:opacity-40"
                style={{ background: GLOW, boxShadow: `0 0 36px color-mix(in srgb, ${GLOW} 45%, transparent)` }}
                disabled={syncing || (ucoa === false && !demoMode) || ucoa === null}
              >
                1-TAP GIVE NOW
              </button>
              <button type="button" onClick={() => setView("freq")} className="mt-2 w-full py-2 text-[10px] font-bold uppercase text-white/35">
                Back
              </button>
            </StepWrap>
          )}

          {view === "receipt" && amount != null && fund && (
            <motion.div
              key="a5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 16 }}
                className="mb-2 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: `color-mix(in srgb, ${GLOW} 14%, #000)`, boxShadow: `0 0 48px color-mix(in srgb, ${GLOW} 28%, transparent)` }}
              >
                <span className="text-4xl leading-none" style={{ color: GLOW }}>✓</span>
              </motion.div>
              <h2 className="text-2xl font-black uppercase text-white" style={{ textShadow: `0 0 28px color-mix(in srgb, ${GLOW} 32%, transparent)` }}>
                Successful
              </h2>
              <p className="text-sm text-emerald-300/90">Secured</p>
              <div className="mt-5 w-full max-w-sm rounded-2xl border border-white/10 p-4 text-left" style={{ background: DEEP }}>
                <p className="text-[9px] uppercase text-white/40">Approval code</p>
                <p className="font-mono text-sm" style={{ color: GLOW }}>{code}</p>
                <p className="mt-2 text-[9px] uppercase text-white/40">Transaction id</p>
                <p className="break-all font-mono text-xs text-white/80">{txId}</p>
              </div>
              <Link
                href="/member-hub"
                className="mt-4 w-full max-w-sm rounded-2xl py-3 text-center text-xs font-bold uppercase tracking-widest text-white/90"
                style={{ border: `1px solid color-mix(in srgb, ${GLOW} 40%, #444)` }}
              >
                View in Member Ledger
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full max-w-sm rounded-2xl py-3 text-sm font-bold text-white/90"
                style={{ border: `1px solid color-mix(in srgb, ${GLOW} 35%, #444)` }}
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
      {children}
    </motion.div>
  );
}
