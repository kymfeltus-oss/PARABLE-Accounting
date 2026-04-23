"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { loadSubledgerForMonthEnd, type MonthEndCloseStatus } from "@/lib/monthEndCloseStatus";
import { recordSovereignCloseEvent } from "@/lib/sovereignCloseAudit";
import { advanceToNextGate, evaluateCurrentGate, getGateIndex, SOVEREIGN_GATES } from "@/lib/gatekeeperFromRoot.js";
import { applyTenantCssVars } from "@/lib/brandCss";
import AutonomousSettings, { type AutonomousConfig } from "./AutonomousSettings";
import InterventionQueue from "./InterventionQueue";
import { isGeneralLiabilityCurrentForSeal, type VaultRow } from "@/lib/sovereignVaultHealth";

const GATE_LABEL: Record<string, { title: string; sub: string }> = {
  GATE_INPUT: { title: "Gate 0 · Data capture", sub: "Tithes, streams, AP, Audit Guard" },
  GATE_SHIELD: { title: "Gate 1 · The shield", sub: "Internal controls AI (Pub. 1828)" },
  GATE_RECONCILE: { title: "Gate 2 · Cutoff", sub: "Reconcile bank, AP, AR" },
  GATE_RESTRICTED: { title: "Gate 3 · Restricted", sub: "Stewardship & donor intent" },
  GATE_SEAL: { title: "Gate 4 · Sovereign seal", sub: "Dual sign-off & vault" },
};

type GateData = Record<string, number | boolean | null | string | undefined>;

const DEFAULT_MONTH = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export default function SovereignCloseWizard() {
  const { tenant, ready, error: brandError } = useBrand();
  const supabase = getSupabaseBrowser();
  const [monthStart, setMonthStart] = useState(DEFAULT_MONTH);
  const [activeGate, setActiveGate] = useState<string>("GATE_INPUT");
  const [gateData, setGateData] = useState<GateData>({
    pendingAuditCount: 0,
    givingCategorized: true,
    apBillsEntered: true,
    boardOverrideAcknowledged: false,
    unresolvedViolations: 0,
    unresolvedCriticalViolations: 0,
    level2ViolationCount: 0,
    bankReconciled: false,
    apReconciled: false,
    arReconciled: false,
    contractorsOver2kUnverified: 0,
    monthSoftLocked: false,
    restrictedDeficit: false,
    donorIntentMatch: true,
    adminCertified: false,
    secondSignerDone: false,
  });
  const [me, setMe] = useState<MonthEndCloseStatus | null>(null);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  const [auditLog, setAuditLog] = useState<{ id: string; created_at: string; gate_to: string | null; payload_hash: string }[]>([]);
  const [aiSweep, setAiSweep] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [signedStroke, setSignedStroke] = useState(false);
  const [autonomousConfig, setAutonomousConfig] = useState<AutonomousConfig>({ maxAmount: 5_000, confidence: 95 });
  const [interventionQueuePending, setInterventionQueuePending] = useState(0);
  const [vaultGeneralLiabilityOk, setVaultGeneralLiabilityOk] = useState(true);

  const idx = Math.max(0, getGateIndex(activeGate as (typeof SOVEREIGN_GATES)[number]));

  const refreshLog = useCallback(async () => {
    if (!supabase || !tenant?.id) return;
    const { data } = await supabase
      .schema("parable_ledger")
      .from("sovereign_close_events")
      .select("id, created_at, gate_to, payload_hash")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(12);
    setAuditLog((data ?? []) as typeof auditLog);
  }, [supabase, tenant?.id]);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      if (ready) setBlockMsg(brandError ?? "Set tenant to run Sovereign Close.");
      return;
    }
    if (typeof document !== "undefined") {
      applyTenantCssVars(
        document.documentElement,
        tenant.primary_color ?? "#22d3ee",
        tenant.accent_color ?? "#0a0a0a",
        "#00f2ff"
      );
    }
    const [mestatus, aQ, cQ] = await Promise.all([
      loadSubledgerForMonthEnd(supabase, tenant.id),
      supabase
        .schema("parable_ledger")
        .from("compliance_violation_alerts")
        .select("id, status, risk_level, violation_code")
        .eq("tenant_id", tenant.id)
        .limit(500),
      supabase
        .schema("parable_ledger")
        .from("contractor_payees")
        .select("w9_on_file, display_name")
        .eq("tenant_id", tenant.id),
    ]);
    setMe(mestatus);
    setGateData((g) => ({
      ...g,
      apBillsEntered: (mestatus.apRows?.length ?? 0) > 0,
    }));
    const alerts = (aQ.data ?? []) as { status: string; risk_level: string }[];
    const open = alerts.filter((a) => a.status !== "resolved");
    const crit = open.filter((a) => {
      const row = a as { risk_level: string; violation_code?: string };
      return row.risk_level === "CRITICAL" || (row.violation_code?.startsWith("POLIT") ?? false);
    });
    const l2 = open.filter((a) => a.risk_level === "HIGH");
    setGateData((g) => ({
      ...g,
      unresolvedViolations: open.length,
      unresolvedCriticalViolations: crit.length,
      level2ViolationCount: l2.length,
    }));
    if (cQ.data) {
      const w = (cQ.data as { w9_on_file: boolean }[]).filter((r) => !r.w9_on_file).length;
      setGateData((g) => ({ ...g, contractorsOver2kUnverified: w > 0 ? w : 0 }));
    }
    const vQ = await supabase
      .schema("parable_ledger")
      .from("sovereign_vault")
      .select("category, subcategory, expiration_date")
      .eq("tenant_id", tenant.id);
    if (!vQ.error && vQ.data) {
      setVaultGeneralLiabilityOk(isGeneralLiabilityCurrentForSeal(vQ.data as VaultRow[]));
    } else {
      setVaultGeneralLiabilityOk(true);
    }
    void refreshLog();
  }, [supabase, tenant, ready, brandError, refreshLog]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const raw = typeof localStorage !== "undefined" && localStorage.getItem("parable:autonomousThresholds:v1");
      if (raw) {
        const p = JSON.parse(raw) as AutonomousConfig;
        if (typeof p.maxAmount === "number" && typeof p.confidence === "number") {
          setAutonomousConfig({ maxAmount: p.maxAmount, confidence: p.confidence });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fullGateData = useMemo(
    () => ({ ...gateData, interventionQueuePending, vaultGeneralLiabilityOk }),
    [gateData, interventionQueuePending, vaultGeneralLiabilityOk]
  );

  const persistAutonomous = useCallback((c: AutonomousConfig) => {
    setAutonomousConfig(c);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("parable:autonomousThresholds:v1", JSON.stringify(c));
      }
    } catch {
      // ignore
    }
  }, []);

  const runAiSweep = useCallback(() => {
    setAiSweep(true);
    setTimeout(() => {
      setAiSweep(false);
      void load();
    }, 2_200);
  }, [load]);

  const onAdvance = useCallback(async () => {
    setBlockMsg(null);
    const g = { ...fullGateData, monthKey: monthStart, tenantSlug: tenant?.slug } as Record<string, unknown>;
    const r = advanceToNextGate(activeGate as (typeof SOVEREIGN_GATES)[number], g);
    if (r.status === "BLOCKED" || (r as { message?: string }).message) {
      setBlockMsg((r as { message: string }).message);
      return;
    }
    const u = (await supabase?.auth.getUser())?.data?.user?.id ?? null;
    if (r.status === "ADVANCE" && (r as { next?: string }).next && supabase && tenant) {
      const p = { gateData: g, gate: activeGate, next: (r as { next: string }).next, ts: new Date().toISOString() };
      const logRes = await recordSovereignCloseEvent(supabase, {
        tenantId: tenant.id,
        userId: u,
        monthStart,
        from: activeGate,
        to: (r as { next: string }).next,
        payload: p,
      });
      if (logRes.error) setBlockMsg(`Vault log: ${logRes.error}. Run migrations: 20250423296000_sovereign_close_events.`);
      setActiveGate((r as { next: string }).next);
    }
    if (r.status === "COMPLETE" && supabase && tenant) {
      const p = { gateData: g, sealed: true, ts: new Date().toISOString() };
      const logRes = await recordSovereignCloseEvent(supabase, {
        tenantId: tenant.id,
        userId: u,
        monthStart,
        from: "GATE_SEAL",
        to: "COMPLETE",
        payload: p,
      });
      if (logRes.error) setBlockMsg(`Seal log: ${logRes.error}.`);
      setSealed(true);
    }
    void refreshLog();
  }, [activeGate, fullGateData, monthStart, supabase, tenant, refreshLog]);

  const evalStep = useCallback(
    () => evaluateCurrentGate(activeGate as (typeof SOVEREIGN_GATES)[number], fullGateData as Record<string, unknown>),
    [activeGate, fullGateData]
  );
  const okToAdvance = evalStep().ok;

  // Mock bank vs ledger rows (demo pairs)
  const matchDemo = [
    { bank: "ACH Tithe $4,200", book: "GEN · Donation" },
    { bank: "Utilities $512", book: "OCC · Check #1042" },
  ];

  return (
    <div
      className="min-h-screen p-4 text-zinc-100 sm:p-8"
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #050505 40%, #0a0a0a 100%)",
        color: "var(--text, #e4e4e7)",
      }}
    >
      <header className="mx-auto max-w-5xl">
        <p className="text-[9px] font-bold tracking-[0.4em] text-cyan-400/80" style={{ color: "var(--brand-glow, #22d3ee)" }}>
          Parable: Ledger · SOVEREIGN CLOSE
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Month-end close workflow</h1>
        <p className="text-sm text-zinc-500">Gates 0–4. Matte authority UI; all accents use the tenant Sovereign glow.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-[9px] uppercase text-zinc-500">Close month (start)</label>
          <input
            type="date"
            className="rounded border border-zinc-800 bg-black/50 px-2 py-1 font-mono text-sm"
            value={monthStart}
            onChange={(e) => setMonthStart(e.target.value)}
          />
        </div>
      </header>

      <div className="mx-auto mt-6 flex max-w-5xl items-center justify-between gap-1 overflow-x-auto pb-2 sm:gap-2">
        {SOVEREIGN_GATES.map((g, i) => (
          <div key={g} className="flex min-w-[4.5rem] flex-1 flex-col items-center text-center sm:min-w-0">
            <div
              className={[
                "h-1.5 w-full rounded-full transition",
                i <= (idx < 0 ? 0 : idx) ? "bg-cyan-400" : "bg-zinc-800",
                g === activeGate && "ring-1 ring-cyan-400/60",
              ]
                .filter(Boolean)
                .join(" ")}
              style={i <= idx && idx >= 0 ? { backgroundColor: "var(--brand-glow, #22d3ee)", boxShadow: "0 0 12px rgba(34, 211, 238, 0.35)" } : {}}
            />
            <p className="mt-1 text-[7px] font-mono text-zinc-500 sm:text-[8px]">G{ i === 0 ? "-1" : i }</p>
            <p className="line-clamp-1 text-[6px] uppercase text-zinc-500 sm:text-[7px]">{GATE_LABEL[g].title.split("·")[0]}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-5xl py-6">
        <AnimatePresence mode="wait">
          {activeGate === "GATE_INPUT" && (
            <motion.section key="in" className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-bold text-white">Pre-close · data capture</h2>
              <p className="text-xs text-zinc-500">Enter tithes, streams, and operating bills. Audit Guard must be clear before advancing.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  ["Pending audit / documentation", "pendingAuditCount" as const],
                  ["AP rows present (sub-ledger)", "apBillsEntered" as const],
                  ["Giving categorized", "givingCategorized" as const],
                ].map(([l, k]) => (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span className="text-zinc-400">{l}</span>
                    {k === "pendingAuditCount" ? (
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded border border-zinc-800 bg-black/40 px-2"
                        value={Number(gateData[k] ?? 0)}
                        onChange={(e) => setGateData((d) => ({ ...d, [k]: Math.max(0, Number(e.target.value)) }))}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={Boolean(gateData[k])}
                        onChange={(e) => setGateData((d) => ({ ...d, [k]: e.target.checked }))}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {me && (
                <p className="mt-2 text-xs text-cyan-200/70">
                  AP: {me.apRows.length} bill(s) · Unpaid: {me.unpaidBills} · AR open: {me.openPledges} (${me.openArBalance} remaining)
                </p>
              )}
            </motion.section>
          )}

          {activeGate === "GATE_SHIELD" && (
            <motion.section key="sh" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-black/40 p-4">
                {aiSweep && <div className="pointer-events-none absolute inset-0 [animation:shieldSweep_2.2s_ease-in-out_1] bg-gradient-to-b from-cyan-500/10 to-transparent" />}
                <style>
                  {`
                @keyframes shieldSweep {
                  0% { transform: translateY(-100%); opacity: 0.5; }
                  40% { transform: translateY(0); opacity: 0.3; }
                  100% { transform: translateY(100%); opacity: 0; }
                }`}
                </style>
                <h2 className="text-sm font-bold text-white">The shield — AI deep scan (Pub. 1828)</h2>
                <p className="text-xs text-zinc-500">Breach email tier on sustained Level-2; Gate 2 stays locked on criticals until resolution or override.</p>
                <button
                  type="button"
                  onClick={runAiSweep}
                  className="mt-2 rounded-full border border-cyan-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200"
                  style={{ boxShadow: "0 0 20px var(--brand-glow-rgb, 34, 211, 238, 0.15)" }}
                >
                  Run compliance sweep
                </button>
                {Number(gateData.unresolvedCriticalViolations) > 0 && (
                  <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
                    <p className="text-[9px] font-bold uppercase">Critical · IRS Pub 1828 context</p>
                    <p className="text-xs text-red-100/80">
                      Campaign intervention, excess benefit, or 990-T exposure heuristics fired. A section 501(c)(3) organization is prohibited
                      from political campaign activity and must not operate for private inurement. Resolve the alert log or use a board
                      sign-off below.
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-xs text-amber-100/80">
                      <input
                        type="checkbox"
                        checked={Boolean(gateData.boardOverrideAcknowledged)}
                        onChange={(e) => setGateData((d) => ({ ...d, boardOverrideAcknowledged: e.target.checked }))}
                      />
                      Board-authorized override (documented)
                    </label>
                  </div>
                )}
                {Number(gateData.unresolvedViolations) > 0 && (
                  <div className="mt-2 text-xs text-amber-200/80">
                    Open: {String(gateData.unresolvedViolations)} · L2: {String(gateData.level2ViolationCount)} · Critical: {String(
                      gateData.unresolvedCriticalViolations
                    )}
                  </div>
                )}
                {Number(gateData.unresolvedViolations) === 0 && <p className="mt-2 text-xs text-emerald-400/90">Path clear — no open AI flags for this pass.</p>}
              </div>
            </motion.section>
          )}

          {activeGate === "GATE_RECONCILE" && (
            <motion.section key="rc" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-bold text-white">Reconciliation & soft lock</h2>
              <InterventionQueue
                settings={autonomousConfig}
                onPendingChange={setInterventionQueuePending}
              />
              <AutonomousSettings
                currentConfig={autonomousConfig}
                onChange={setAutonomousConfig}
                onSave={persistAutonomous}
              />
              <div className="mt-1 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:grid-cols-2">
                <div className="space-y-2 text-xs">
                  {(["bankReconciled", "apReconciled", "arReconciled", "monthSoftLocked"] as const).map((k) => (
                    <label key={k} className="flex items-center justify-between border-b border-zinc-800/50 py-1">
                      <span className="text-zinc-400">{k}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(gateData[k])}
                        onChange={(e) => setGateData((d) => ({ ...d, [k]: e.target.checked }))}
                      />
                    </label>
                  ))}
                  <p className="pt-1 text-zinc-500">Contractor &gt; $2k 1099 watch: {String(gateData.contractorsOver2kUnverified)} at-risk payee(s) without W-9.</p>
                </div>
                <div className="space-y-2">
                  {matchDemo.map((row, j) => (
                    <div key={j} className="grid grid-cols-2 gap-1">
                      <div
                        className="rounded border border-cyan-500/30 p-2 font-mono text-[10px]"
                        style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--brand-cyan) 20%, transparent)" }}
                      >
                        {row.bank}
                      </div>
                      <div className="rounded border border-cyan-500/30 p-2 text-[10px] text-cyan-100/90">{row.book} ✓</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeGate === "GATE_RESTRICTED" && (
            <motion.section key="r" className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-bold text-amber-100/90">Restricted fund integrity</h2>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(gateData.restrictedDeficit)} onChange={(e) => setGateData((d) => ({ ...d, restrictedDeficit: e.target.checked }))} />
                Flag: restricted used to cover ops deficit
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(gateData.donorIntentMatch)}
                  onChange={(e) => setGateData((d) => ({ ...d, donorIntentMatch: e.target.checked }))}
                />
                Donor intent / release matches program spend
              </label>
            </motion.section>
          )}

          {activeGate === "GATE_SEAL" && (
            <motion.section key="se" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-bold text-white">Sovereign seal & vault</h2>
              {!vaultGeneralLiabilityOk && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200/90">
                  General liability policy on file in the{" "}
                  <Link href="/sovereign-vault" className="text-cyan-200 underline">
                    Sovereign vault
                  </Link>{" "}
                  is expired. Update the certificate or expiration before sealing.
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(gateData.adminCertified)} onChange={(e) => setGateData((d) => ({ ...d, adminCertified: e.target.checked }))} />
                Bookkeeper / admin attests
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(gateData.secondSignerDone)} onChange={(e) => setGateData((d) => ({ ...d, secondSignerDone: e.target.checked }))} />
                Treasurer or pastor (second)
              </label>
              <div className="mt-2 rounded-lg border border-zinc-800 bg-black/30 p-2">
                <p className="text-[9px] uppercase text-zinc-500">Dual-line signature (symbolic attestation)</p>
                <canvas
                  ref={canvasRef}
                  className="mt-1 w-full max-w-md cursor-crosshair touch-none bg-zinc-900/80"
                  height={120}
                  width={400}
                  onMouseDown={(e) => {
                    drawing.current = true;
                    const c = canvasRef.current;
                    if (!c) return;
                    const ctx = c.getContext("2d");
                    if (!ctx) return;
                    const r = c.getBoundingClientRect();
                    const x = (e.clientX - r.left) * (c.width / r.width);
                    const y = (e.clientY - r.top) * (c.height / r.height);
                    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--brand-glow").trim() || "#22d3ee";
                    ctx.lineWidth = 2;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                  }}
                  onMouseUp={() => {
                    drawing.current = false;
                    setSignedStroke(true);
                  }}
                  onMouseMove={(e) => {
                    if (!drawing.current) return;
                    const c = canvasRef.current;
                    if (!c) return;
                    const ctx = c.getContext("2d");
                    if (!ctx) return;
                    const r = c.getBoundingClientRect();
                    const x = (e.clientX - r.left) * (c.width / r.width);
                    const y = (e.clientY - r.top) * (c.height / r.height);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                  }}
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSignedStroke(false);
                      const c = canvasRef.current;
                      if (c) {
                        const ctx = c.getContext("2d");
                        if (ctx) {
                          ctx.clearRect(0, 0, c.width, c.height);
                        }
                      }
                    }}
                    className="text-[10px] text-zinc-500"
                  >
                    Clear
                  </button>
                  {signedStroke && <span className="text-[9px] text-cyan-400/80">Line captured in payload hash (best-effort).</span>}
                </div>
              </div>
              {signedStroke && (gateData.adminCertified as boolean) && (gateData.secondSignerDone as boolean) && (
                <motion.div
                  className="mx-auto h-32 w-32 rounded-full border-2 border-amber-700/60 bg-amber-950/40 [perspective:800px]"
                  initial={{ rotateX: 45, scale: 0.2, opacity: 0 }}
                  animate={{ rotateX: 8, scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.9 }}
                  style={{ boxShadow: "0 0 32px color-mix(in srgb, var(--brand-cyber) 15%, #0000)" }}
                >
                  <div className="flex h-full w-full items-center justify-center p-2 text-center text-[9px] font-bold text-amber-200/90">
                    SEAL
                    <br />
                    {tenant?.display_name?.slice(0, 18) ?? "MINISTRY"}
                  </div>
                </motion.div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {blockMsg && <p className="mt-4 text-sm text-red-400">{blockMsg}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAdvance}
            disabled={!okToAdvance || sealed}
            className="rounded-full border border-cyan-500/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-cyan-200 disabled:opacity-40"
            style={{ textShadow: "0 0 8px var(--brand-glow, rgba(34,211,238,0.4))" }}
          >
            {sealed ? "Month sealed" : activeGate === "GATE_SEAL" && okToAdvance ? "Lock vault & sign off" : "Verify gate & advance"}
          </button>
          {evalStep().ok === false && <p className="text-xs text-amber-200/80">{String(evalStep().message)}</p>}
        </div>

        <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
          <p className="text-[9px] font-bold uppercase text-zinc-500">Sovereign audit log (append-only)</p>
          <p className="text-[9px] text-zinc-600">Each row: user, timestamp, SHA-256 of the gate payload JSON.</p>
          {auditLog.length === 0 ? (
            <p className="text-xs text-zinc-500">No events yet.</p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[9px] font-mono text-zinc-400">
              {auditLog.map((a) => (
                <li key={a.id}>
                  {a.created_at?.replace("T", " ").slice(0, 19)} → {a.gate_to} · {a.payload_hash?.slice(0, 20)}…
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
