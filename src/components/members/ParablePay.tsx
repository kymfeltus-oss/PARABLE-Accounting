"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { useActiveMember } from "@/context/ActiveMemberContext";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";

/** Givlify mirror spec — fixed cinematic cyan (Sovereign) */
const GLOW = "#00FFFF";
const MATTE = "#050505";
const MATTE_DEEP = "#0a0a0a";

const AMOUNTS = [10, 25, 50, 100, 250, 500] as const;

type FundOption = { id: string; label: string; sub: string; ucoa: string };
/** UCOA-mapped fund display (rows post to `fund_id` = GEN / MSN / BLD) */
const FUNDS: FundOption[] = [
  { id: "GEN", label: "Tithes & Offerings", sub: "General (unrestricted)", ucoa: "4010 · General tithes" },
  { id: "MSN", label: "Missions", sub: "Great Commission (restricted)", ucoa: "Missions fund route" },
  { id: "BLD", label: "Project Building Fund", sub: "Capital (restricted)", ucoa: "BLD / capex" },
];

type Step = "home" | "amount" | "fund" | "confirm" | "syncing" | "receipt";

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function makeApprovalCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PP-${part()}-${part()}`;
}

const sanctuaryUrl =
  "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1920&q=90";

const SIMULATED_SETTLE_MS = 1_500;

/**
 * Givlify mirror — matte Sovereign, #00FFFF accents. PENDING → 1.5s → SECURED; AR/GL via DB + realtime hints.
 */
export default function ParablePay() {
  const { tenant, ready: brandReady } = useBrand();
  const { activeMember } = useActiveMember();
  const supabase = getSupabaseBrowser();

  const [step, setStep] = useState<Step>("home");
  const [amountDollars, setAmountDollars] = useState<number | null>(null);
  const [otherDraft, setOtherDraft] = useState("");
  const [otherMode, setOtherMode] = useState(false);
  const [fund, setFund] = useState<FundOption | null>(null);
  const [approvalCode, setApprovalCode] = useState("");
  const [receiptAt, setReceiptAt] = useState<Date | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [glJournalEntryId, setGlJournalEntryId] = useState<string | null>(null);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [ucoaOk, setUcoaOk] = useState<boolean | null>(null);
  const [ucoaMessage, setUcoaMessage] = useState<string | null>(null);
  const [amountFlash, setAmountFlash] = useState<string | null>(null);
  const [glStreamReady, setGlStreamReady] = useState(false);
  const [arStreamReady, setArStreamReady] = useState(false);

  const reset = useCallback(() => {
    setStep("home");
    setAmountDollars(null);
    setOtherDraft("");
    setOtherMode(false);
    setFund(null);
    setApprovalCode("");
    setReceiptAt(null);
    setPostError(null);
    setGlJournalEntryId(null);
    setContributionId(null);
    setAmountFlash(null);
    setGlStreamReady(false);
    setArStreamReady(false);
  }, []);

  useEffect(() => {
    if (!brandReady || !supabase || !tenant?.id) {
      setUcoaOk(null);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .schema("parable_ledger")
        .from("chart_of_accounts")
        .select("account_code")
        .eq("tenant_id", tenant.id)
        .in("account_code", [1010, 4010]);
      if (error) {
        setUcoaOk(false);
        setUcoaMessage(`UCOA check failed: ${error.message}`);
        return;
      }
      const codes = new Set((data ?? []).map((r) => (r as { account_code: number }).account_code));
      const ok = codes.has(1010) && codes.has(4010);
      setUcoaOk(ok);
      setUcoaMessage(
        ok
          ? null
          : "This tenant is missing 1010 (operating cash) and/or 4010 (revenue) in chart_of_accounts. Add UCOA lines, then return."
      );
    })();
  }, [brandReady, supabase, tenant?.id]);

  const onSelectAmount = (n: number) => {
    setOtherMode(false);
    setAmountDollars(n);
    setStep("fund");
  };

  const flashAndSelect = (key: string, n: number) => {
    setAmountFlash(key);
    window.setTimeout(() => {
      setOtherMode(false);
      setAmountDollars(n);
      setStep("fund");
      window.setTimeout(() => setAmountFlash(null), 200);
    }, 120);
  };

  const onOtherContinue = () => {
    const v = Number.parseFloat(otherDraft.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(v) && v > 0) {
      setAmountDollars(Math.round(v * 100) / 100);
      setStep("fund");
    }
  };

  const fetchPostedRow = useCallback(
    async (id: string) => {
      if (!supabase) return null;
      for (let i = 0; i < 8; i++) {
        const { data, error } = await supabase
          .schema("parable_ledger")
          .from("member_contributions")
          .select("gl_journal_entry_id, gl_posted_at, id, status")
          .eq("id", id)
          .maybeSingle();
        if (error) return null;
        if (data?.gl_journal_entry_id) return data;
        await new Promise((r) => setTimeout(r, 100 * (i + 1)));
      }
      return null;
    },
    [supabase]
  );

  const onConfirmGive = async () => {
    if (!supabase || !tenant?.id || !fund || amountDollars == null) return;
    if (!activeMember) {
      setPostError("No active member session. Open Member hub and select your name on the roster.");
      return;
    }
    if (ucoaOk === false) {
      setPostError(ucoaMessage ?? "UCOA not ready for 1010 / 4010.");
      return;
    }
    if (ucoaOk !== true) {
      setPostError("Verifying UCOA lines — try again in a moment.");
      return;
    }
    setPostError(null);
    setGlStreamReady(false);
    setArStreamReady(false);
    const code = makeApprovalCode();
    setStep("syncing");
    try {
      const { data: ins, error: insErr } = await supabase
        .schema("parable_ledger")
        .from("member_contributions")
        .insert({
          tenant_id: tenant.id,
          member_id: activeMember.id,
          amount: amountDollars,
          fund_id: fund.id,
          status: "PENDING",
          revenue_account_code: 4010,
          metadata: { parable_approval: code, source: "parable_pay_ui" },
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      const cid = (ins as { id: string }).id;
      setContributionId(cid);
      setApprovalCode(code);
      setArStreamReady(true);
      await new Promise((r) => setTimeout(r, SIMULATED_SETTLE_MS));
      const { error: upErr } = await supabase
        .schema("parable_ledger")
        .from("member_contributions")
        .update({ status: "SECURED", updated_at: new Date().toISOString() })
        .eq("id", cid)
        .eq("tenant_id", tenant.id);
      if (upErr) throw new Error(upErr.message);
      setReceiptAt(new Date());
      const posted = await fetchPostedRow(cid);
      setGlJournalEntryId(posted?.gl_journal_entry_id ?? null);
      if (posted?.gl_journal_entry_id) setGlStreamReady(true);
      setStep("receipt");
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Could not record gift");
      setStep("confirm");
    }
  };

  const glowLine = (active: boolean) =>
    active
      ? {
          boxShadow: `0 0 24px color-mix(in srgb, ${GLOW} 40%, transparent), inset 0 0 0 1px color-mix(in srgb, ${GLOW} 55%, transparent)`,
        }
      : { boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08)` };

  const cta = useMemo(
    () => ({
      background: GLOW,
      boxShadow: `0 0 36px color-mix(in srgb, ${GLOW} 45%, transparent), 0 4px 0 color-mix(in srgb, ${GLOW} 10%, #000)`,
    }),
    []
  );

  const canTransact = Boolean(activeMember) && ucoaOk === true;
  const sessionBlock = !activeMember;

  // Realtime: new GL line tied to this contribution = silent background confirmation (no full page refresh).
  useEffect(() => {
    if (step !== "receipt" || !supabase || !tenant?.id || !contributionId) return;
    if (glJournalEntryId) {
      setGlStreamReady(true);
      return;
    }
    const ch = supabase
      .channel(`pp-gl-ar-${contributionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "parable_ledger", table: "general_ledger", filter: `tenant_id=eq.${tenant.id}` },
        (p) => {
          const row = p.new as { source_id?: string; source_type?: string };
          if (row?.source_id === contributionId) {
            setGlStreamReady(true);
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [step, supabase, tenant?.id, contributionId, glJournalEntryId]);

  const glowStyle: CSSProperties = { ["--pp-cyan" as string]: GLOW } as CSSProperties;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />
      <div
        className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[2.25rem] border text-left shadow-2xl"
        style={{
          borderColor: `color-mix(in srgb, ${GLOW} 30%, #27272a)`,
          background: `linear-gradient(180deg, ${MATTE_DEEP} 0%, ${MATTE} 100%)`,
          minHeight: "min(92vh, 720px)",
          ...glowStyle,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, ${GLOW} 50%, transparent), transparent)`,
          }}
          aria-hidden
        />

        <div className="relative z-[1] flex min-h-[min(92vh,720px)] flex-col" style={glowStyle}>
          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Session</p>
            {activeMember?.full_name ? (
              <p className="mt-1 text-sm font-semibold text-white/90">{activeMember.full_name}</p>
            ) : (
              <p className="mt-1 text-xs text-amber-200/90">
                None — open{" "}
                <Link href="/member-hub" className="font-semibold underline" style={{ color: GLOW }}>
                  Member hub
                </Link>{" "}
                and tap your name.
              </p>
            )}
            {ucoaMessage && ucoaOk === false && (
              <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-100/90">{ucoaMessage}</p>
            )}
          </div>

          <header
            className="flex items-center justify-between px-4 pt-1 pb-2"
            style={{ ["--pp-cyan" as string]: GLOW } as CSSProperties}
          >
            {step !== "home" && step !== "receipt" && step !== "syncing" ? (
              <button
                type="button"
                onClick={() => {
                  if (step === "amount") setStep("home");
                  else if (step === "fund") setStep("amount");
                  else if (step === "confirm") setStep("fund");
                }}
                className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:text-[var(--pp-cyan)]"
              >
                ← Back
              </button>
            ) : (
              <span className="w-12" />
            )}
            <span
              className="text-[9px] font-bold uppercase tracking-[0.35em]"
              style={{ color: `color-mix(in srgb, ${GLOW} 90%, #fff)` }}
            >
              Parable Pay
            </span>
            {step === "receipt" ? (
              <button
                type="button"
                onClick={reset}
                className="text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-[var(--pp-cyan)]"
              >
                Done
              </button>
            ) : (
              <span className="w-12" />
            )}
          </header>

          <AnimatePresence mode="wait">
            {step === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.6 }}
                className="relative flex min-h-0 flex-1 flex-col"
              >
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <div className="absolute inset-0 min-h-[50vh] bg-[#000]" />
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${sanctuaryUrl})` }}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, ${MATTE} 0%, transparent 28%, rgba(0,0,0,0.45) 50%, ${MATTE} 100%)`,
                    }}
                  />
                  <div className="absolute bottom-32 left-0 right-0 px-6 text-center">
                    <p
                      className="text-2xl font-black uppercase tracking-[0.2em] text-white/95"
                      style={{ textShadow: `0 0 48px color-mix(in srgb, ${GLOW} 35%, transparent), 0 2px 24px #000` }}
                    >
                      GIVE
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-white/60">Full-bleed sanctuary · one tap, sovereign ledger</p>
                  </div>
                </div>
                <div className="p-5 pb-8">
                  {postError && <p className="mb-2 text-center text-[10px] text-amber-200/90">{postError}</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setPostError(null);
                      if (sessionBlock) {
                        setPostError("Set your member session in Member hub first.");
                        return;
                      }
                      if (ucoaOk === false) {
                        setPostError("UCOA 1010 / 4010 required before giving.");
                        return;
                      }
                      if (ucoaOk !== true) {
                        setPostError("UCOA check loading — wait a moment.");
                        return;
                      }
                      setStep("amount");
                    }}
                    disabled={!canTransact}
                    className="pp-give-cyan-pulse w-full cursor-pointer rounded-2xl border-2 border-transparent py-4 text-center text-sm font-black uppercase tracking-[0.35em] text-[#0a0a0a] transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    style={cta}
                  >
                    GIVE
                  </button>
                </div>
              </motion.div>
            )}

            {step === "amount" && (
              <motion.div
                key="amount"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-1 flex-col px-4 pb-6"
              >
                <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Select amount</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {AMOUNTS.map((n) => {
                    const k = `p-${n}`;
                    const hit = amountFlash === k;
                    return (
                      <motion.button
                        key={n}
                        type="button"
                        onClick={() => flashAndSelect(k, n)}
                        className="rounded-xl border border-white/[0.07] py-3.5 text-sm font-bold tabular-nums text-white/95"
                        whileTap={{ scale: 0.95 }}
                        style={{
                          background: MATTE_DEEP,
                          boxShadow: hit
                            ? `0 0 0 1px color-mix(in srgb, ${GLOW} 60%, #fff), 0 0 28px color-mix(in srgb, ${GLOW} 45%, transparent), inset 0 0 24px color-mix(in srgb, ${GLOW} 15%, transparent)`
                            : `inset 0 0 0 1px color-mix(in srgb, ${GLOW} 8%, transparent)`,
                        }}
                      >
                        {formatMoney(n)}
                      </motion.button>
                    );
                  })}
                  <motion.button
                    type="button"
                    onClick={() => {
                      setAmountFlash("other");
                      window.setTimeout(() => setAmountFlash(null), 280);
                      setOtherMode(true);
                      setAmountDollars(null);
                    }}
                    className="col-span-3 rounded-xl py-3.5 text-sm font-bold uppercase tracking-widest text-white/80"
                    whileTap={{ scale: 0.98 }}
                    style={{
                      background: MATTE_DEEP,
                      border: `1px dashed color-mix(in srgb, ${GLOW} 50%, #444)`,
                      boxShadow:
                        amountFlash === "other"
                          ? `0 0 32px color-mix(in srgb, ${GLOW} 30%, transparent)`
                          : "none",
                    }}
                  >
                    Other
                  </motion.button>
                </div>
                {otherMode && (
                  <div className="mt-4 space-y-2 rounded-xl border border-white/10 p-3" style={{ background: MATTE_DEEP }}>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/40" htmlFor="pp-other-m">
                      Custom amount
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="pp-other-m"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={otherDraft}
                        onChange={(e) => setOtherDraft(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-lg text-white outline-none"
                        style={{ boxShadow: `0 0 0 1px color-mix(in srgb, ${GLOW} 12%, transparent)` }}
                      />
                      <button
                        type="button"
                        onClick={onOtherContinue}
                        className="shrink-0 rounded-lg px-4 text-xs font-bold uppercase tracking-widest text-[#0a0a0a]"
                        style={{ background: GLOW }}
                      >
                        Go
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === "fund" && (
              <motion.div
                key="fund"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col overflow-hidden px-4 pb-6"
              >
                <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Select fund (UCOA)</p>
                {amountDollars != null && (
                  <p className="mb-3 text-center font-mono text-2xl font-bold tabular-nums" style={{ color: GLOW }}>
                    {formatMoney(amountDollars)}
                  </p>
                )}
                <ul className="sovereign-submenu-hover-scroll max-h-56 space-y-2 overflow-y-auto pr-0.5">
                  {FUNDS.map((f) => {
                    const sel = fund?.id === f.id;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setFund(f)}
                          className="w-full rounded-xl p-3.5 text-left transition"
                          style={{
                            background: sel ? `color-mix(in srgb, ${GLOW} 8%, ${MATTE_DEEP})` : MATTE_DEEP,
                            boxShadow: sel
                              ? `0 0 0 1px color-mix(in srgb, ${GLOW} 50%, transparent), 0 0 22px color-mix(in srgb, ${GLOW} 14%, transparent)`
                              : glowLine(false).boxShadow,
                          }}
                        >
                          <p className="text-sm font-bold text-white/95">{f.label}</p>
                          <p className="mt-0.5 text-[10px] text-white/50">{f.sub}</p>
                          <p className="mt-1 text-[9px] font-mono uppercase tracking-wide" style={{ color: `color-mix(in srgb, ${GLOW} 80%, #a1a1aa)` }}>
                            {f.ucoa}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-auto pt-4">
                  <button
                    type="button"
                    disabled={!fund}
                    onClick={() => setStep("confirm")}
                    className="w-full rounded-2xl py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-[#0a0a0a] transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ background: fund ? GLOW : "#444" }}
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            )}

            {step === "confirm" && amountDollars != null && fund && activeMember && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col justify-between px-4 pb-8"
              >
                <div>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">1-Tap · Summary</p>
                  <p className="mt-2 text-center text-lg font-bold leading-tight text-white/95">Member</p>
                  <p className="text-center text-xl font-black" style={{ color: GLOW }}>
                    {activeMember.full_name}
                  </p>
                  <p
                    className="mt-6 text-center font-mono text-4xl font-bold tabular-nums leading-none"
                    style={{ color: GLOW, textShadow: `0 0 40px color-mix(in srgb, ${GLOW} 30%, transparent)` }}
                  >
                    {formatMoney(amountDollars)}
                  </p>
                  <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-white/40">Total amount</p>
                  <div className="mt-5 rounded-2xl border border-white/10 p-4" style={{ background: MATTE_DEEP }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Fund</p>
                    <p className="mt-1 text-sm font-semibold text-white/95">{fund.label}</p>
                    <p className="text-[10px] text-white/50">{fund.ucoa}</p>
                  </div>
                </div>
                {postError && <p className="mb-2 text-center text-[10px] text-amber-200/90">{postError}</p>}
                <button
                  type="button"
                  onClick={() => void onConfirmGive()}
                  className="w-full rounded-2xl border-0 py-4 text-sm font-black uppercase tracking-[0.2em] text-[#0a0a0a] transition active:scale-[0.99]"
                  style={cta}
                >
                  1-TAP GIVE NOW
                </button>
              </motion.div>
            )}

            {step === "syncing" && (
              <motion.div
                key="syncing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-20 text-center"
              >
                <div
                  className="h-12 w-12 animate-spin rounded-full border-2 border-white/15"
                  style={{ borderTopColor: GLOW }}
                  aria-hidden
                  role="status"
                />
                <p className="text-lg font-bold tracking-wide text-white/90">Syncing to AR Ledger…</p>
                <p className="text-sm text-white/50">Awaiting 1010 / 4010 handshake · 1.5s simulated path</p>
                {arStreamReady && <p className="text-[10px] font-mono text-emerald-300/80">PENDING row saved · sub-ledger aware</p>}
              </motion.div>
            )}

            {step === "receipt" && amountDollars != null && fund && receiptAt && (
              <motion.div
                key="receipt"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-1 flex-col items-center px-5 pb-10 text-center"
              >
                <div
                  className="mt-4 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${GLOW} 12%, ${MATTE})`,
                    boxShadow: `0 0 64px color-mix(in srgb, ${GLOW} 32%, transparent)`,
                  }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M5 12.5L10 17L19 7"
                      stroke={GLOW}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ filter: `drop-shadow(0 0 8px color-mix(in srgb, ${GLOW} 70%, transparent))` }}
                    />
                  </svg>
                </div>
                <h2
                  className="mt-5 text-2xl font-black uppercase tracking-[0.2em] text-white"
                  style={{ textShadow: `0 0 28px color-mix(in srgb, ${GLOW} 40%, transparent)` }}
                >
                  Successful
                </h2>
                <p className="mt-1 text-sm text-white/50">SECURED · double-entry in background (no page refresh required)</p>
                {glStreamReady && glJournalEntryId && (
                  <p className="mt-2 text-[10px] font-mono text-emerald-200/80">GL updated · {glJournalEntryId}</p>
                )}

                <div className="mt-6 w-full rounded-2xl border border-white/10 p-4 text-left" style={{ background: MATTE_DEEP }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Receipt details</p>
                  <p className="mt-1 font-mono text-lg font-semibold" style={{ color: GLOW }}>
                    {formatMoney(amountDollars)}
                  </p>
                  <p className="mt-2 text-sm text-white/85">{fund.label}</p>
                  <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/40">Approval code</p>
                  <p className="mt-0.5 font-mono text-sm text-white/90">{approvalCode}</p>
                  {contributionId && (
                    <>
                      <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/40">Transaction ID</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-white/80">{contributionId}</p>
                    </>
                  )}
                  <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/40">Date</p>
                  <p className="mt-0.5 font-mono text-xs text-white/80">
                    {receiptAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[9px] font-mono text-white/45">
                        {glStreamReady ? "Ledgers: AR + GL in sync" : "Opening realtime channel to confirm GL line…"}
                      </p>
                      <Link
                        href="/accounting/gl"
                        className="text-center text-[10px] font-bold uppercase tracking-widest hover:opacity-100"
                        style={{ color: GLOW }}
                      >
                        GL viewer →
                      </Link>
                    </div>
                    <Link
                      href="/member-hub"
                      className="mt-2 inline-block w-full rounded-xl border border-white/10 py-2.5 text-center text-xs font-bold text-white/90 transition hover:border-white/20"
                    >
                      View in Member Ledger
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

const PULSE_CSS = `
@keyframes parable-cyan-outer {
  0%, 100% { box-shadow: 0 0 20px color-mix(in srgb, #00ffff 35%, transparent), 0 0 48px color-mix(in srgb, #00ffff 20%, transparent), 0 4px 0 color-mix(in srgb, #00ffff 8%, #000); }
  50% { box-shadow: 0 0 32px color-mix(in srgb, #00ffff 55%, transparent), 0 0 72px color-mix(in srgb, #00ffff 32%, transparent), 0 4px 0 color-mix(in srgb, #00ffff 10%, #000); }
}
.pp-give-cyan-pulse { animation: parable-cyan-outer 2.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .pp-give-cyan-pulse { animation: none; }
}
`;
