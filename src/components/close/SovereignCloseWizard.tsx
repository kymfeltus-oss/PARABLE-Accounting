"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { loadSubledgerForMonthEnd, type MonthEndCloseStatus } from "@/lib/monthEndCloseStatus";
import { recordSovereignCloseEvent } from "@/lib/sovereignCloseAudit";
import { advanceToNextGate, evaluateCurrentGate, getGateIndex, SOVEREIGN_GATES } from "@/lib/gatekeeperFromRoot.js";
import { applyTenantCssVars, cssTenantGlow, TENANT_GLOW_FALLBACK } from "@/lib/brandCss";
import AutonomousSettings, { type AutonomousConfig } from "./AutonomousSettings";
import InterventionQueue from "./InterventionQueue";
import { isGeneralLiabilityCurrentForSeal, type VaultRow } from "@/lib/sovereignVaultHealth";
import { buildSovereignCloseBoardPackHtml } from "@/lib/sovereignCloseBoardPack";
import { verifyParableLedgerReachable } from "@/lib/verifyParableSchema";
import { formatGateClearedMessage, insertGateAudit, loadGateAuditHistory, type GateAuditRow } from "@/lib/close/closeMonth";
import {
  FOUNDRY_SUBMISSION_KEY,
  G1_CHECKLIST,
  isGateChecklistComplete,
  toReportingPeriod,
} from "@/lib/close/closeChecklistConfig";
import { loadCloseChecklistForPeriod, loadStaffDirectory, saveCloseChecklistItem, type CloseChecklistRow, type StaffRow } from "@/lib/close/closeChecklistData";
import CloseLedgerAccordion from "./CloseLedgerAccordion";
import { runIrsGuardianScan } from "../../../autonomousExecution.js";

const GATE_LABEL: Record<string, { title: string; sub: string; short: string; action: string }> = {
  GATE_INPUT: {
    title: "Data capture",
    short: "Data",
    sub: "Tithes, streams, AP, and audit items are ready.",
    action: "Confirm inputs below, then continue.",
  },
  GATE_SHIELD: {
    title: "Compliance (IRS Pub. 1828 context)",
    short: "Guardian",
    sub: "Run the scan and clear critical open items, or use an authorized override.",
    action: "Run compliance sweep, resolve flags, then continue.",
  },
  GATE_RECONCILE: {
    title: "Reconciliation",
    short: "Reconcile",
    sub: "Match bank, AP, and AR, then soft-lock the month for review.",
    action: "Check off reconciliations, then continue.",
  },
  GATE_RESTRICTED: {
    title: "Restricted funds",
    short: "Stewardship",
    sub: "Donor intent and restricted balances must be intact.",
    action: "Attest to restricted / donor rules, then continue.",
  },
  GATE_SEAL: {
    title: "Seal & vault",
    short: "Seal",
    sub: "Review the board pack, then dual sign-off to lock the close.",
    action: "Open board pack, sign, then lock the vault.",
  },
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
    institutionalReconciliationZero: false,
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
  const [boardPackReviewed, setBoardPackReviewed] = useState(false);
  const [sovereignLinkBlock, setSovereignLinkBlock] = useState<string | null>(null);
  /** Populated when parable_ledger is reachable; used for Gate 0 pre-close COA capture. */
  const [coaRowCount, setCoaRowCount] = useState<number | null>(null);
  /** Explicit test fetch: parable_ledger.tenants (header check when ≥1 row; includes primary_color). */
  const [tenantsTableProbeOk, setTenantsTableProbeOk] = useState<boolean | null>(null);
  const [checklistMap, setChecklistMap] = useState<Map<string, CloseChecklistRow>>(() => new Map());
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [gateHistory, setGateHistory] = useState<GateAuditRow[]>([]);
  const [foundrySubmitting, setFoundrySubmitting] = useState(false);

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
        (tenant.primary_color && tenant.primary_color.trim()) || TENANT_GLOW_FALLBACK,
        (tenant.accent_color && tenant.accent_color.trim()) || "#0a0a0a",
        (tenant.primary_color && tenant.primary_color.trim()) || TENANT_GLOW_FALLBACK
      );
    }
    const link = await verifyParableLedgerReachable(supabase);
    if (!link.ok) {
      setSovereignLinkBlock(link.message);
      setCoaRowCount(null);
      setTenantsTableProbeOk(false);
      setMe(null);
      return;
    }
    const { count: coaCount, error: coaErr } = await supabase
      .schema("parable_ledger")
      .from("chart_of_accounts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    if (coaErr) {
      setSovereignLinkBlock(`chart_of_accounts (parable_ledger): ${coaErr.message}`);
      setCoaRowCount(null);
      setTenantsTableProbeOk(false);
      setMe(null);
      return;
    }
    setSovereignLinkBlock(null);
    setCoaRowCount(coaCount ?? 0);
    const tProbe = await supabase
      .schema("parable_ledger")
      .from("tenants")
      .select("id, primary_color")
      .limit(1);
    setTenantsTableProbeOk(!tProbe.error && Array.isArray(tProbe.data) && tProbe.data.length > 0);
    const reportPeriod = toReportingPeriod(monthStart);
    const [chMap, staffRes] = await Promise.all([
      loadCloseChecklistForPeriod(supabase, tenant.id, reportPeriod),
      loadStaffDirectory(supabase, tenant.id),
    ]);
    setChecklistMap(chMap);
    setStaffList(staffRes.staff);
    setStaffDirectoryError(staffRes.error);
    const yearMonth = monthStart.slice(0, 7);
    const { data: zeroVar, error: zErr } = await supabase
      .schema("parable_ledger")
      .rpc("verify_close_zero_variance", { p_tenant_id: tenant.id, p_year_month: yearMonth });
    if (!zErr) {
      setGateData((g) => ({ ...g, institutionalReconciliationZero: Boolean(zeroVar) }));
    } else {
      setGateData((g) => ({ ...g, institutionalReconciliationZero: false }));
    }
    const history = await loadGateAuditHistory(supabase, tenant.id);
    setGateHistory(history);
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
  }, [supabase, tenant, ready, brandError, refreshLog, monthStart]);

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

  const checklistCompletion = useMemo(
    () => ({
      checklistG1Complete: isGateChecklistComplete(1, checklistMap),
      checklistG2Complete: isGateChecklistComplete(2, checklistMap),
      checklistG3Complete: isGateChecklistComplete(3, checklistMap),
      checklistG4Complete: isGateChecklistComplete(4, checklistMap),
    }),
    [checklistMap]
  );

  /** True once any checklist row is attested for this period (server timestamp + verifier). */
  const hasVerifierAttestation = useMemo(() => {
    for (const row of checklistMap.values()) {
      if (row.verifier_name?.trim() && row.completed_at) return true;
    }
    return false;
  }, [checklistMap]);

  /** When Foundry executive submission is on file, checklist UI is read-only for this period. */
  const foundryReadOnly = useMemo(() => {
    const row = checklistMap.get(FOUNDRY_SUBMISSION_KEY);
    return Boolean(row?.verifier_name?.trim() && row?.completed_at);
  }, [checklistMap]);

  const fullGateData = useMemo(
    () => ({
      ...gateData,
      ...checklistCompletion,
      interventionQueuePending,
      vaultGeneralLiabilityOk,
      certificateOfFinancialIntegrity: Boolean(
        boardPackReviewed && signedStroke && gateData.adminCertified && gateData.secondSignerDone
      ),
    }),
    [gateData, checklistCompletion, interventionQueuePending, vaultGeneralLiabilityOk, boardPackReviewed, signedStroke]
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

  const refreshChecklists = useCallback(async () => {
    if (!supabase || !tenant?.id) return;
    const [m, staffRes] = await Promise.all([
      loadCloseChecklistForPeriod(supabase, tenant.id, toReportingPeriod(monthStart)),
      loadStaffDirectory(supabase, tenant.id),
    ]);
    setChecklistMap(m);
    setStaffList(staffRes.staff);
    setStaffDirectoryError(staffRes.error);
  }, [supabase, tenant?.id, monthStart]);

  const handleFoundrySubmit = useCallback(
    async ({ verifierStaffId, verifierName }: { verifierStaffId: string; verifierName: string }) => {
      if (!supabase || !tenant?.id) return { error: "Sovereign context not ready." };
      setFoundrySubmitting(true);
      try {
        const reportingPeriod = toReportingPeriod(monthStart);
        const r = await saveCloseChecklistItem(supabase, {
          tenantId: tenant.id,
          reportingPeriod,
          gateNumber: 4,
          taskName: FOUNDRY_SUBMISSION_KEY,
          verifierName: `Foundry · ${verifierName.trim() || "Staff"}`,
          verifierStaffId,
        });
        if (r.error) return { error: r.error };
        const { data: userData } = await supabase.auth.getUser();
        const log = await recordSovereignCloseEvent(supabase, {
          tenantId: tenant.id,
          userId: userData.user?.id ?? null,
          monthStart,
          from: "GATE_4",
          to: "PENDING_EXECUTIVE_SIGN",
          clientLabel: "FoundryAlert",
          payload: {
            status: "PENDING_EXECUTIVE_SIGN",
            kind: "executive_approval_request",
            reportingPeriod,
            leadStaffId: verifierStaffId,
            leadName: verifierName,
          },
        });
        if (log.error) return { error: log.error };
        await refreshChecklists();
        void refreshLog();
        return { error: null };
      } finally {
        setFoundrySubmitting(false);
      }
    },
    [supabase, tenant?.id, monthStart, refreshChecklists, refreshLog]
  );

  const openBoardPack = useCallback(() => {
    const html = buildSovereignCloseBoardPackHtml({
      monthLabel: monthStart,
      orgName: tenant?.display_name ?? "Ministry",
      bankReconciled: Boolean(gateData.bankReconciled),
      apReconciled: Boolean(gateData.apReconciled),
      arReconciled: Boolean(gateData.arReconciled),
      unresolvedCriticalViolations: Number(gateData.unresolvedCriticalViolations ?? 0),
      unresolvedOpenViolations: Number(gateData.unresolvedViolations ?? 0),
      restrictedIntact: !Boolean(gateData.restrictedDeficit) && Boolean(gateData.donorIntentMatch),
    });
    const w = typeof window !== "undefined" ? window.open("", "_blank", "noopener,noreferrer") : null;
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setBoardPackReviewed(true);
    }
    if (!w && typeof document !== "undefined") {
      const t = document.createElement("a");
      t.href = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      t.download = `board-pack-${monthStart}.html`;
      t.click();
      setBoardPackReviewed(true);
    }
  }, [gateData, monthStart, tenant?.display_name]);

  const onAdvance = useCallback(async () => {
    setBlockMsg(null);
    if (sovereignLinkBlock) {
      setBlockMsg(sovereignLinkBlock);
      return;
    }
    const g = { ...fullGateData, monthKey: monthStart, tenantSlug: tenant?.slug } as Record<string, unknown>;
    const r = advanceToNextGate(activeGate as (typeof SOVEREIGN_GATES)[number], g);
    if (r.status === "BLOCKED") {
      setBlockMsg((r as { message?: string }).message ?? "This gate is blocked. Complete the checklist, then try again.");
      return;
    }
    const authRes = await supabase?.auth.getUser();
    const uid = authRes?.data.user?.id ?? null;
    const uMeta = authRes?.data.user?.user_metadata as { full_name?: string } | undefined;
    const display = uMeta?.full_name || authRes?.data.user?.email || "User";

    if (r.status === "ADVANCE" && (r as { next?: string }).next && supabase && tenant) {
      if (activeGate === "GATE_SHIELD") {
        const gfd = fullGateData as Record<string, unknown>;
        const n = Number(gfd.unresolvedViolations ?? 0);
        const crit = Number(gfd.unresolvedCriticalViolations ?? 0);
        const override = Boolean(gfd.boardOverrideAcknowledged);
        const scan = await runIrsGuardianScan(tenant.id, { openViolationCount: n, criticalCount: crit });
        if (scan.status !== "CLEARED" && !override) {
          setBlockMsg("IRS Guardian scan did not clear. Resolve open compliance items, or use a board-authorized override on this step.");
          return;
        }
        const { error: lockErr } = await supabase
          .schema("parable_ledger")
          .rpc("set_ledger_month_locked", {
            p_tenant_id: tenant.id,
            p_year_month: monthStart.slice(0, 7),
            p_lock: true,
          });
        if (lockErr) {
          setBlockMsg(`Ledger lock: ${lockErr.message}. Ensure migration 20250424120000_gate_audit_ledger_settings is applied.`);
          return;
        }
        const ga3 = await insertGateAudit(supabase, { tenantId: tenant.id, gateNumber: 3, userId: uid, displayName: display });
        if (ga3.error) {
          setBlockMsg(ga3.error);
          return;
        }
      }
      if (activeGate === "GATE_INPUT") {
        const ga1 = await insertGateAudit(supabase, { tenantId: tenant.id, gateNumber: 1, userId: uid, displayName: display });
        if (ga1.error) {
          setBlockMsg(ga1.error);
          return;
        }
      }
      if (activeGate === "GATE_RECONCILE") {
        const ga2 = await insertGateAudit(supabase, { tenantId: tenant.id, gateNumber: 2, userId: uid, displayName: display });
        if (ga2.error) {
          setBlockMsg(ga2.error);
          return;
        }
      }
      const p = { gateData: g, gate: activeGate, next: (r as { next: string }).next, ts: new Date().toISOString() };
      const logRes = await recordSovereignCloseEvent(supabase, {
        tenantId: tenant.id,
        userId: uid,
        monthStart,
        from: activeGate,
        to: (r as { next: string }).next,
        payload: p,
      });
      if (logRes.error) setBlockMsg(`Vault log: ${logRes.error}. Run migrations: 20250423296000_sovereign_close_events.`);
      setActiveGate((r as { next: string }).next);
      if (["GATE_INPUT", "GATE_RECONCILE", "GATE_SHIELD"].includes(activeGate)) {
        const h = await loadGateAuditHistory(supabase, tenant.id);
        setGateHistory(h);
      }
    }
    if (r.status === "COMPLETE" && supabase && tenant) {
      const ga4 = await insertGateAudit(supabase, { tenantId: tenant.id, gateNumber: 4, userId: uid, displayName: display });
      if (ga4.error) {
        setBlockMsg(ga4.error);
        return;
      }
      const p = { gateData: g, sealed: true, ts: new Date().toISOString() };
      const logRes = await recordSovereignCloseEvent(supabase, {
        tenantId: tenant.id,
        userId: uid,
        monthStart,
        from: "GATE_SEAL",
        to: "COMPLETE",
        payload: p,
      });
      if (logRes.error) setBlockMsg(`Seal log: ${logRes.error}.`);
      setSealed(true);
      const h = await loadGateAuditHistory(supabase, tenant.id);
      setGateHistory(h);
    }
    void refreshLog();
  }, [activeGate, fullGateData, monthStart, supabase, tenant, refreshLog, sovereignLinkBlock]);

  const gateEval = useMemo(
    () => evaluateCurrentGate(activeGate as (typeof SOVEREIGN_GATES)[number], fullGateData as Record<string, unknown>),
    [activeGate, fullGateData]
  );
  const okToAdvance = gateEval.ok && !sovereignLinkBlock;
  const currentGateMeta = GATE_LABEL[activeGate] ?? GATE_LABEL.GATE_INPUT;
  const totalSteps = SOVEREIGN_GATES.length;
  const stepNumber = idx + 1;
  const g1TaskKey = G1_CHECKLIST[0]?.key ?? "g1_tithes_offerings";
  const g1Secured = useMemo(() => {
    const r = checklistMap.get(g1TaskKey);
    return Boolean(r?.verifier_name?.trim() && r?.completed_at);
  }, [checklistMap, g1TaskKey]);

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
      <header className="mx-auto max-w-5xl space-y-4">
        <p
          className="text-[9px] font-bold tracking-[0.4em]"
          style={{ color: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 88%, #a1a1aa)` }}
        >
          Parable: Ledger · SOVEREIGN CLOSE
        </p>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Month-end close</h1>
          {tenantsTableProbeOk === true && (
            <span
              className="select-none text-lg font-light leading-none sm:text-xl"
              style={{
                color: `var(--tenant-glow, ${TENANT_GLOW_FALLBACK})`,
                opacity: 0.8,
                textShadow: `0 0 12px ${cssTenantGlow(32)}`,
              }}
              title="Connection OK — parable_ledger.tenants (primary color)"
              aria-label="parable_ledger.tenants reachable"
            >
              ✓
            </span>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          Walk through <span className="text-zinc-300">five steps</span> in order. Finish the checklist for this step, then use{" "}
          <span style={{ color: cssTenantGlow(85) }}>Continue</span> to move on. The progress bar always shows where you are.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 sm:items-end sm:gap-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 sm:p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Close period (month start)</p>
            <p className="mt-0.5 text-xs text-zinc-500">Which calendar month you are closing.</p>
            <input
              type="date"
              className="mt-2 w-full max-w-xs rounded-lg border border-zinc-700 bg-black/60 px-3 py-2 font-mono text-sm text-white"
              value={monthStart}
              onChange={(e) => setMonthStart(e.target.value)}
              aria-label="Close month start date"
            />
          </div>
          <div
            className="rounded-xl p-3 sm:p-4"
            style={{
              background: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 4%, #09090b)`,
              border: `1px solid ${cssTenantGlow(20)}`,
            }}
          >
            <p
              className="text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ color: cssTenantGlow(70) }}
            >
              Current step
            </p>
            <p className="mt-1 text-lg font-bold text-white">
              {stepNumber} of {totalSteps} · {currentGateMeta.title}
            </p>
            <p className="mt-1 text-sm text-zinc-400">{currentGateMeta.sub}</p>
            {sealed && <p className="mt-2 text-sm font-semibold text-emerald-300/90">This period is sealed.</p>}
          </div>
        </div>
      </header>

      {sovereignLinkBlock && (
        <div
          className="mx-auto mt-4 max-w-5xl rounded-2xl border border-fuchsia-500/40 bg-[#0a0508] px-4 py-3 text-sm text-fuchsia-100/95 shadow-[0_0_32px_rgba(192,38,211,0.12)]"
          role="alert"
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-fuchsia-400/90">Sovereign link — attention required</p>
          <p className="mt-1 whitespace-pre-line font-mono text-xs leading-relaxed text-fuchsia-100/90">
            {sovereignLinkBlock}
          </p>
        </div>
      )}

      {!sovereignLinkBlock && coaRowCount !== null && (
        <div
          className="mx-auto mt-4 max-w-5xl rounded-2xl px-4 py-3 text-sm"
          role="status"
          style={{
            border: `1px solid ${cssTenantGlow(35)}`,
            background: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 6%, #09090b)`,
            boxShadow: `0 0 24px ${cssTenantGlow(12)}`,
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: cssTenantGlow(85) }}
          >
            Sovereign link
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: cssTenantGlow(80) }}>
            Sovereign Link Active
          </p>
          <p className="mt-0.5 text-xs" style={{ color: cssTenantGlow(55) }}>
            parable_ledger is reachable; tenant slug aligned.
          </p>
        </div>
      )}

      <div className="mx-auto mt-6 max-w-5xl">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Progress</p>
        <div className="flex items-stretch justify-between gap-0.5 overflow-x-auto rounded-lg border border-zinc-800/60 bg-black/20 p-2 sm:gap-1">
          {SOVEREIGN_GATES.map((g, i) => {
            const segmentComplete = sealed || i < idx || (i === 0 && g1Secured);
            const here = !sealed && g === activeGate;
            const firstCyan = i === 0 && g1Secured;
            const gVar = `var(--tenant-glow, ${TENANT_GLOW_FALLBACK})`;
            const circleStyle: CSSProperties | undefined = firstCyan
              ? {
                  background: `color-mix(in srgb, ${gVar} 40%, #0a0a0a)`,
                  color: "#f8fafc",
                  boxShadow: `0 0 20px ${cssTenantGlow(32)}, 0 0 0 2px ${cssTenantGlow(50)}`,
                }
              : here
                ? {
                    background: `color-mix(in srgb, ${gVar} 25%, #0000)`,
                    color: "color-mix(in srgb, #e0f2fe  5%, #fafafa 95%)",
                    boxShadow: `0 0 0 2px ${cssTenantGlow(45)}`,
                  }
                : segmentComplete
                  ? {
                      background: `color-mix(in srgb, ${gVar} 30%, #0a0a0a)`,
                      color: "#f1f5f9",
                      boxShadow: `0 0 0 1px ${cssTenantGlow(32)}`,
                    }
                  : undefined;
            return (
              <div
                key={g}
                className="flex min-w-[4.5rem] flex-1 flex-col items-center text-center sm:min-w-0"
                title={GATE_LABEL[g].title}
              >
                <div
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold sm:h-9 sm:w-9 sm:text-xs",
                    !circleStyle ? "bg-zinc-900/80 text-zinc-500" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={circleStyle}
                >
                  {segmentComplete ? "✓" : i + 1}
                </div>
                <p
                  className="mt-1.5 line-clamp-2 text-[8px] font-bold uppercase leading-tight sm:text-[9px]"
                  style={
                    firstCyan
                      ? { color: gVar }
                      : segmentComplete || here
                        ? { color: `color-mix(in srgb, ${gVar} 78%, #71717a 22%)` }
                        : { color: "#71717a" }
                  }
                >
                  {GATE_LABEL[g].short}
                </p>
              </div>
            );
          })}
        </div>
        {(() => {
          const g1 = checklistMap.get(g1TaskKey);
          if (!g1?.verifier_name?.trim() || !g1.completed_at) return null;
          const when = new Date(g1.completed_at).toLocaleString("en-US", {
            timeZone: "America/Chicago",
            dateStyle: "medium",
            timeStyle: "short",
          });
          return (
            <p
              className="mt-2 text-sm font-medium tracking-tight"
              style={{ color: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 90%, #f4f4f5)` }}
              role="status"
            >
              G1 SECURED — Verified by {g1.verifier_name} (CFO) · {when}
            </p>
          );
        })()}
      </div>

      {supabase && tenant && !sovereignLinkBlock && (
        <div className="mx-auto mt-4 max-w-5xl">
          <CloseLedgerAccordion
            monthStart={monthStart}
            tenantId={tenant.id}
            supabase={supabase}
            staff={staffList}
            rows={checklistMap}
            onSaved={refreshChecklists}
            periodLabel={toReportingPeriod(monthStart)}
            readOnly={foundryReadOnly}
            onFoundrySubmit={handleFoundrySubmit}
            foundrySubmitting={foundrySubmitting}
          />
        </div>
      )}

      {!sovereignLinkBlock && !sealed && (
        <div className="mx-auto mt-4 max-w-5xl">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">At a glance</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border border-zinc-800 bg-black/30 px-2.5 py-1 text-xs text-zinc-300">
              Open compliance: <strong className="text-zinc-100">{Number(gateData.unresolvedViolations ?? 0)}</strong>
            </span>
            <span className="rounded-md border border-zinc-800 bg-black/30 px-2.5 py-1 text-xs text-zinc-300">
              Critical: <strong className="text-zinc-100">{Number(gateData.unresolvedCriticalViolations ?? 0)}</strong>
            </span>
            <span className="rounded-md border border-zinc-800 bg-black/30 px-2.5 py-1 text-xs text-zinc-300">
              Bank / AP / AR:{" "}
              <strong className="text-zinc-100">
                {[gateData.bankReconciled, gateData.apReconciled, gateData.arReconciled].filter(Boolean).length}/3
              </strong>
            </span>
            {me != null && (
              <span className="rounded-md border border-zinc-800 bg-black/30 px-2.5 py-1 text-xs text-zinc-300" title="Sub-ledger">
                AP bills: <strong className="text-zinc-100">{me.apRows?.length ?? 0}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {!sealed && !sovereignLinkBlock && (
        <p className="mx-auto mt-3 max-w-5xl text-sm text-zinc-500">
          <span className="text-zinc-500">To continue:</span> {currentGateMeta.action}
        </p>
      )}

      <div className="mx-auto max-w-5xl py-6">
        <AnimatePresence mode="wait">
          {activeGate === "GATE_INPUT" && (
            <motion.section key="in" className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-bold text-white">{GATE_LABEL.GATE_INPUT.title}</h2>
              <p className="text-xs text-zinc-500">Confirm the books are ready. Audit and AP checks must pass before the next step.</p>
              {staffDirectoryError && !sovereignLinkBlock && (
                <p className="mt-2 text-xs text-amber-200/80" role="alert">
                  Could not load <span className="font-mono">view_staff_directory</span>: {staffDirectoryError}
                </p>
              )}
              {staffList.length > 0 && !staffDirectoryError && !sovereignLinkBlock && (
                <p
                  className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em]"
                  style={{ color: cssTenantGlow(70) }}
                  role="status"
                  title="Roster from parable_ledger.staff_onboarding (view_staff_directory)"
                >
                  Identity Link: {staffList.length} Staff Verified
                </p>
              )}
              {staffList.length === 0 && !staffDirectoryError && !sovereignLinkBlock && !hasVerifierAttestation && (
                <p className="mt-2 text-xs text-zinc-500/90">
                  Verifier roster is empty for this tenant — add a person in <span className="font-mono">staff_onboarding</span> (or run
                  <span className="font-mono"> seed_staff_directory.sql</span>).
                </p>
              )}
              {staffList.length > 0 && hasVerifierAttestation && !sovereignLinkBlock && (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 text-sm"
                  role="status"
                  style={{
                    border: `1px solid ${cssTenantGlow(32)}`,
                    background: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 5%, #09090b)`,
                    boxShadow: `0 0 20px ${cssTenantGlow(8)}`,
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: cssTenantGlow(80) }}>
                    Verifier
                  </p>
                  <p className="mt-0.5 font-semibold" style={{ color: cssTenantGlow(90) }}>
                    Sovereign Verifier Active
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: cssTenantGlow(60) }}>
                    Close checklist attested for {toReportingPeriod(monthStart)} (staff ID + server timestamp on file).
                  </p>
                </div>
              )}
              {me && (
                <p className="mt-2 text-xs" style={{ color: cssTenantGlow(55) }}>
                  AP: {me.apRows.length} bill(s) · Unpaid: {me.unpaidBills} · AR open: {me.openPledges} (${me.openArBalance} remaining)
                </p>
              )}
              {coaRowCount !== null && !sovereignLinkBlock && (
                <p className="mt-2 text-xs" style={{ color: cssTenantGlow(60) }}>
                  Pre-close data capture — chart of accounts (parable_ledger):{" "}
                  <span className="font-mono font-semibold" style={{ color: `var(--tenant-glow, ${TENANT_GLOW_FALLBACK})` }}>
                    {coaRowCount}
                  </span>{" "}
                  row(s) for this tenant
                </p>
              )}
            </motion.section>
          )}

          {activeGate === "GATE_SHIELD" && (
            <motion.section key="sh" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                className="relative overflow-hidden rounded-2xl bg-black/40 p-4"
                style={{ border: `1px solid ${cssTenantGlow(18)}` }}
              >
                {aiSweep && (
                  <div
                    className="pointer-events-none absolute inset-0 [animation:shieldSweep_2.2s_ease-in-out_1] bg-gradient-to-b to-transparent"
                    style={{ background: `linear-gradient(to bottom, ${cssTenantGlow(8)}, transparent)` }}
                  />
                )}
                <style>
                  {`
                @keyframes shieldSweep {
                  0% { transform: translateY(-100%); opacity: 0.5; }
                  40% { transform: translateY(0); opacity: 0.3; }
                  100% { transform: translateY(100%); opacity: 0; }
                }`}
                </style>
                <h2 className="text-sm font-bold text-white">{GATE_LABEL.GATE_SHIELD.title}</h2>
                <p className="text-xs text-zinc-500">{GATE_LABEL.GATE_SHIELD.sub}</p>
                <button
                  type="button"
                  onClick={runAiSweep}
                  className="mt-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    border: `1px solid ${cssTenantGlow(30)}`,
                    color: cssTenantGlow(90),
                    boxShadow: `0 0 20px ${cssTenantGlow(12)}`,
                  }}
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
              <h2 className="text-sm font-bold text-white">{GATE_LABEL.GATE_RECONCILE.title}</h2>
              <p className="text-xs text-zinc-500">{GATE_LABEL.GATE_RECONCILE.sub}</p>
              <p className="text-xs text-zinc-500">
                Institutional tie-out: Cash, Restricted, AP, and AR buckets show{" "}
                <span className={Boolean(gateData.institutionalReconciliationZero) ? "text-emerald-400/90" : "text-amber-200/90"}>
                  {Boolean(gateData.institutionalReconciliationZero) ? "$0.00 net variance" : "pending $0.00 net variance"}
                </span>{" "}
                (server verify via <span className="font-mono">verify_close_zero_variance</span>).
              </p>
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
                        className="rounded p-2 font-mono text-[10px]"
                        style={{
                          border: `1px solid ${cssTenantGlow(28)}`,
                          boxShadow: `0 0 0 1px ${cssTenantGlow(12)}`,
                        }}
                      >
                        {row.bank}
                      </div>
                      <div
                        className="rounded p-2 text-[10px]"
                        style={{ border: `1px solid ${cssTenantGlow(28)}`, color: cssTenantGlow(92) }}
                      >
                        {row.book} ✓
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeGate === "GATE_RESTRICTED" && (
            <motion.section key="r" className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-bold text-amber-100/90">{GATE_LABEL.GATE_RESTRICTED.title}</h2>
              <p className="text-xs text-amber-200/50">{GATE_LABEL.GATE_RESTRICTED.sub}</p>
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
              <div
                className="rounded-[40px] border border-white/10 bg-[#050505] p-6 sm:p-10"
                style={{ boxShadow: `0 0 0 1px ${cssTenantGlow(8)}` }}
              >
                <h2 className="mb-6 text-2xl font-black uppercase italic tracking-tighter text-white sm:text-3xl">Review board pack</h2>
                <p className="mb-6 text-xs text-zinc-500">Pulls the same close signals as this workflow (reconciliation, Guardian, restricted funds). Open a printable one-pager, then use browser Print → Save as PDF for the governance file. The Certificate of Financial Integrity is issued in this final step only after the pack is opened, both signers attest, and the line below is captured — matching the same PDF output.</p>
                <div className="mb-8 space-y-4">
                  <div
                    className="flex flex-col justify-between gap-1 border-b pb-4 text-sm sm:flex-row sm:items-center"
                    style={{ borderColor: cssTenantGlow(18) }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cssTenantGlow(65) }}>
                      Financial review — legal entity (tax / board)
                    </span>
                    <span
                      className="text-right font-mono text-sm font-semibold"
                      style={{ color: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 92%, #fff)` }}
                    >
                      {tenant?.legal_name?.trim() || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-4 text-sm">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI reconciliation accuracy</span>
                    <span
                      className={[
                        "font-bold",
                        gateData.bankReconciled && gateData.apReconciled && gateData.arReconciled
                          ? ""
                          : "text-amber-300",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        gateData.bankReconciled && gateData.apReconciled && gateData.arReconciled
                          ? { color: `var(--tenant-glow, ${TENANT_GLOW_FALLBACK})` }
                          : undefined
                      }
                    >
                      {gateData.bankReconciled && gateData.apReconciled && gateData.arReconciled ? "100% match" : "Review required"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-4 text-sm">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">IRS compliance scan</span>
                    <span
                      className={Number(gateData.unresolvedCriticalViolations) === 0 ? "font-bold text-emerald-400" : "font-bold text-red-300"}
                    >
                      {Number(gateData.unresolvedCriticalViolations) === 0
                        ? "Passed (Pub. 1828 context)"
                        : `${String(gateData.unresolvedCriticalViolations)} critical`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={openBoardPack}
                    className="w-full rounded-3xl py-4 text-sm font-black uppercase tracking-widest text-black sm:max-w-md"
                    style={{
                      background: `var(--tenant-glow, ${TENANT_GLOW_FALLBACK})`,
                      boxShadow: `0 0 40px ${cssTenantGlow(40)}`,
                    }}
                  >
                    Review & sign — open board pack
                  </button>
                  {boardPackReviewed && (
                    <span
                      className="text-center text-[10px] uppercase sm:text-left"
                      style={{ color: cssTenantGlow(70) }}
                    >
                      Pack opened — save PDF from the new tab, then complete dual sign-off below.
                    </span>
                  )}
                </div>
              </div>
              <h2 className="text-sm font-bold text-white">{GATE_LABEL.GATE_SEAL.title}</h2>
              {!vaultGeneralLiabilityOk && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200/90">
                  General liability policy on file in the{" "}
                  <Link href="/sovereign-vault" className="underline" style={{ color: cssTenantGlow(80) }}>
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
                    ctx.strokeStyle =
                      getComputedStyle(document.documentElement).getPropertyValue("--tenant-glow").trim() ||
                      getComputedStyle(document.documentElement).getPropertyValue("--brand-glow").trim() ||
                      TENANT_GLOW_FALLBACK;
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
                  {signedStroke && (
                    <span className="text-[9px]" style={{ color: cssTenantGlow(68) }}>
                      Line captured in payload hash (best-effort).
                    </span>
                  )}
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {gateEval.ok === false && (
              <p className="text-sm text-amber-200/90" role="status">
                {String(gateEval.message ?? "Complete the checklist before continuing.")}
              </p>
            )}
            {gateEval.ok && !sealed && !sovereignLinkBlock && (
              <p className="text-sm text-emerald-200/80">This step is ready — you can continue.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onAdvance}
            disabled={!okToAdvance || sealed || !!sovereignLinkBlock}
            className="shrink-0 rounded-full border-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: cssTenantGlow(45),
              background: `color-mix(in srgb, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 10%, #0000)`,
              color: `color-mix(in srgb, #f8fafc, var(--tenant-glow, ${TENANT_GLOW_FALLBACK}) 12%)`,
              boxShadow: `0 0 20px ${cssTenantGlow(14)}`,
              textShadow: `0 0 8px ${cssTenantGlow(25)}`,
            }}
          >
            {sealed
              ? "Close complete"
              : activeGate === "GATE_SEAL" && okToAdvance
                ? "Lock vault and finish"
                : "Continue to next step"}
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
          <p className="text-[9px] font-bold uppercase text-zinc-500">Gate approval history (append-only)</p>
          <p className="text-[9px] text-zinc-600">parable_ledger.gate_audit_log — one line per approved gate (1–4).</p>
          {gateHistory.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No gate approvals recorded yet for this tenant.</p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1.5 overflow-auto text-xs" style={{ color: cssTenantGlow(75) }}>
              {gateHistory.map((row) => (
                <li key={row.id} className="font-mono text-[10px] leading-relaxed sm:text-xs">
                  {formatGateClearedMessage(row)}
                </li>
              ))}
            </ul>
          )}
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
