"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { scanForViolations, sumLobbyingYtd, sumUbiYtdForYear } from "@/lib/complianceFromRoot.js";
import { sendComplianceAlert } from "@/lib/complianceFromRoot.js";
import { scanStreamMetadata } from "@/lib/statementFromRoot.js";
import ComplianceRadar, { type StatementViolation } from "@/components/compliance/ComplianceRadar";

type TxRow = {
  id: string;
  amount: number;
  created_at: string;
  is_ubi: boolean;
  irs_category: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  contribution_nature: string;
  tx_type?: string;
};

type Viol = {
  code: string;
  type: string;
  description: string;
  correction: string;
  irsRef: string;
  risk: string;
};

type AlertRow = {
  id: string;
  transaction_id: string | null;
  violation_code: string;
  violation_type: string;
  status: "open" | "acknowledged" | "resolved";
  email_sent_at: string | null;
  created_at: string;
  resolved_at: string | null;
  description: string;
  correction: string;
};

const IRS_PUB_1828_SNIPS: Record<
  string,
  { head: string; text: string }
> = {
  "p1828-inurement": {
    head: "Inurement (Pub 1828 overview)",
    text: "A section 501(c)(3) organization must not be organized or operate for the benefit of private individuals or private interests, and no part of its net earnings may inure to the benefit of private individuals (such as disqualified persons). Unreasonable compensation, loans, and certain transactions with insiders are common areas of focus—document the process and seek advice when a transaction benefits insiders or looks like a private benefit.",
  },
  "p1828-political": {
    head: "Political campaign activity",
    text: "Section 501(c)(3) tax-exempt status absolutely prohibits campaign intervention. Disqualifying activity includes (but is not limited to) direct or indirect participation in political campaigns, endorsements, and outlays whose primary effect is to influence a campaign. The prohibition is strict; voting as private individuals is not the same as the organization’s activities.",
  },
  "p1828-lobbying": {
    head: "Lobbying limits (churches and elections)",
    text: "Churches are generally not subject to the 501(h) election rules in the same way as other public charities, but substantial lobbying (attempting to influence legislation) is still a facts-and-circumstances test. If your organization (not a church) makes the 501(h) election, track the lobbying and grass-roots ceilings; otherwise, lobbying cannot be a substantial part of your activities. Education on issues (without a call to action) may differ from lobbying. Consult your advisor and Form 990 Schedule C where applicable.",
  },
  "form-990-t": {
    head: "Unrelated business income (990-T context)",
    text: "Gross UBI in excess of the filing threshold (currently $1,000) generally requires Form 990-T for an organization with UBI, subject to specific statutory exceptions and the trade-or-business test. The annual threshold is a filing trigger for tax-exempt organizations, not a safe harbor to ignore UBI. Coordinate with a preparer; state UBIT may also apply.",
  },
};

const DEFAULT_INBOX = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_COMPLIANCE_ALERT_TO) || "board@your-ministry.org";

function vendorFromTx(t: TxRow) {
  const m = t.metadata;
  if (!m || typeof m !== "object") return { name: "" as string | undefined };
  return {
    name: (m.vendor_name as string) || (m.vendor as string) || (m.payee as string) || undefined,
  };
}

function withDesc(tx: TxRow): TxRow & { description: string } {
  const m = tx.metadata;
  const d =
    (m && typeof m === "object" && (m.description as string | undefined)) ||
    (m && typeof m === "object" && (m.memo as string | undefined)) ||
    tx.source ||
    "";
  return { ...tx, description: d };
}

function CompliancePulse({ openCount, lastScan, scanning }: { openCount: number; lastScan: Date | null; scanning: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-950/50 to-zinc-950/80 px-5 py-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-400/80">Compliance pulse</p>
        <p className="mt-1 text-lg font-mono text-white">
          <span className="text-cyan-400">{openCount}</span> <span className="text-sm text-zinc-400">open / flagged</span>
        </p>
        {lastScan ? (
          <p className="text-[10px] text-zinc-500">Last full scan: {lastScan.toLocaleString()}</p>
        ) : (
          <p className="text-[10px] text-zinc-500">No scan yet</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={["h-2.5 w-2.5 rounded-full", scanning ? "animate-pulse bg-cyan-400 shadow-[0_0_10px_#22d3ee]" : "bg-zinc-600"].join(" ")}
        />
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">IRS Guardian</span>
      </div>
    </div>
  );
}

function GlitchRow({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-lg transition-[box-shadow,background-color]",
        active
          ? "bg-gradient-to-r from-red-950/30 via-zinc-950/40 to-red-950/20 shadow-[0_0_0_1px_rgba(239,68,68,0.4),inset_0_0_40px_rgba(255,0,0,0.12)]"
          : "hover:bg-zinc-900/40",
      ].join(" ")}
    >
      {active && (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "repeating-linear-gradient(90deg, rgba(255,0,0,0.1) 0, rgba(255,0,0,0.1) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px)",
              animation: "glitchShift 2.1s steps(2,end) infinite",
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 mix-blend-color-dodge opacity-20 [mask-image:linear-gradient(90deg,transparent,black,transparent)]" aria-hidden />
        </>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export default function IrsGuardian() {
  const supabase = getSupabaseBrowser();
  const { tenant, ready, error: brandError } = useBrand();
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [violMap, setViolMap] = useState<Record<string, Viol[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [inbox, setInbox] = useState(DEFAULT_INBOX);
  const [selected, setSelected] = useState<{ tx: TxRow; v: Viol } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [streamMetadataJson, setStreamMetadataJson] = useState("{}");
  /** Public stream/YouTube copy is strictly scanned; internal-only sermon transcript skips Johnson-style heuristics here. */
  const [statementScanAudience, setStatementScanAudience] = useState<"public" | "internal">("public");
  const [statementHits, setStatementHits] = useState<StatementViolation[]>([]);

  const runEngineRef = useRef<((txOverride?: TxRow[]) => void | Promise<void>) | undefined>(undefined);
  const hasInitialScan = useRef(false);
  useEffect(() => {
    hasInitialScan.current = false;
  }, [tenant?.id]);

  const activeTotal = useMemo(() => Object.values(violMap).reduce((a, b) => a + b.length, 0), [violMap]);
  const dbOpen = useMemo(
    () => alerts.filter((a) => a.status === "open" || a.status === "acknowledged").length,
    [alerts]
  );

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      if (ready) setErr(brandError ?? "Configure tenant and Supabase to run the compliance engine.");
      return;
    }
    setErr(null);
    const [r1, r2] = await Promise.all([
      supabase
        .schema("parable_ledger")
        .from("transactions")
        .select("id,amount,created_at,is_ubi,irs_category,source,metadata,contribution_nature,tenant_id,tx_type")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .schema("parable_ledger")
        .from("compliance_violation_alerts")
        .select("id,transaction_id,violation_code,violation_type,status,email_sent_at,created_at,resolved_at,description,correction")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (r1.error) {
      setErr(r1.error.message);
      return;
    }
    if (r2.error) {
      setErr(r2.error.message);
    }
    setTxRows((r1.data ?? []) as TxRow[]);
    setAlerts((r2.data ?? []) as AlertRow[]);
  }, [supabase, tenant, ready, brandError]);

  const runEngine = useCallback(
    async (txOverride?: TxRow[]) => {
      const list = txOverride ?? txRows;
      if (!supabase || !tenant?.id || list.length === 0) {
        setScanning(false);
        return;
      }
      setScanning(true);
      setScanKey((k) => k + 1);

      const { data: alertList } = await supabase
        .schema("parable_ledger")
        .from("compliance_violation_alerts")
        .select("id, transaction_id, violation_code, status")
        .eq("tenant_id", tenant.id)
        .limit(2000);

      const y = new Date().getUTCFullYear();
      const totalU = sumUbiYtdForYear(list, y);
      const lob = sumLobbyingYtd(list);
      const resolved = new Set(
        (alertList ?? [])
          .filter((a) => a.status === "resolved" && a.transaction_id)
          .map((a) => `${a.transaction_id}|${a.violation_code}`)
      );

      const m: Record<string, Viol[]> = {};
      for (const raw of list) {
        const t = withDesc(raw);
        const internalWorship =
          raw.metadata &&
          typeof raw.metadata === "object" &&
          String((raw.metadata as { compliance_channel?: string }).compliance_channel || "") === "internal_worship";
        const vlist = scanForViolations(t, vendorFromTx(raw), {
          totalAnnualUbi: totalU,
          lobbyingYtd: lob,
          speechContext: internalWorship ? "internal_worship" : "public_ledger",
        }) as Viol[];
        m[t.id] = vlist.filter((v) => !resolved.has(`${t.id}|${v.code}`));
      }
      setViolMap(m);
      setLastScan(new Date());

      for (const raw of list) {
        const t = withDesc(raw);
        for (const v of m[t.id] ?? []) {
          const { data: ins, error: inErr } = await supabase
            .schema("parable_ledger")
            .from("compliance_violation_alerts")
            .insert({
              tenant_id: tenant.id,
              transaction_id: t.id,
              violation_code: v.code,
              violation_type: v.type,
              description: v.description,
              correction: v.correction,
              irs_ref_key: v.irsRef,
              risk_level: v.risk,
              status: "open",
              email_recipient: inbox,
            })
            .select("id")
            .maybeSingle();
          if (inErr) {
            const msg = inErr.message;
            if (!/duplicate|unique|23505|violat|already exists/i.test(msg)) {
              console.error("[IrsGuardian] insert", msg);
            }
            continue;
          }
          if (!ins?.id) continue;
          const to = inbox;
          if (to) {
            const r = await fetch("/api/compliance/alert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to, violation: v }),
            });
            if (!r.ok) {
              void sendComplianceAlert(v, to);
            }
          } else {
            void sendComplianceAlert(v, "");
          }
          await supabase
            .schema("parable_ledger")
            .from("compliance_violation_alerts")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", ins.id);
        }
      }

      setScanning(false);
      void load();
    },
    [inbox, load, supabase, tenant, txRows]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    runEngineRef.current = runEngine;
  }, [runEngine]);

  useEffect(() => {
    const t = setInterval(() => {
      if (txRows.length > 0) void runEngineRef.current?.();
    }, 60_000);
    return () => clearInterval(t);
  }, [txRows.length]);

  useEffect(() => {
    if (txRows.length === 0) {
      return;
    }
    if (hasInitialScan.current) return;
    hasInitialScan.current = true;
    setTimeout(() => {
      void runEngineRef.current?.();
    }, 200);
  }, [txRows, txRows.length]);

  // Realtime: new transaction
  useEffect(() => {
    if (!supabase || !tenant?.id) return;
    const ch = supabase
      .channel("irs-guardian-tx")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "parable_ledger", table: "transactions", filter: `tenant_id=eq.${tenant.id}` },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, tenant?.id, load]);

  const onResolve = async (note: string) => {
    if (!supabase || !tenant || !selected) return;
    setResolving(true);
    setErr(null);
    const a = alerts.find(
      (x) => x.transaction_id === selected.tx.id && x.violation_code === selected.v.code && (x.status === "open" || x.status === "acknowledged")
    );
    if (a) {
      const { error } = await supabase
        .schema("parable_ledger")
        .from("compliance_violation_alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_note: note || null })
        .eq("id", a.id);
      if (error) setErr(error.message);
    }
    setSelected(null);
    await load();
    setResolving(false);
  };

  const year = new Date().getUTCFullYear();
  const totalU = sumUbiYtdForYear(txRows, year);
  const lobY = sumLobbyingYtd(txRows);

  return (
    <div className="relative min-h-screen bg-zinc-950 p-4 text-zinc-100 sm:p-8">
      <style>
        {`
        @keyframes glitchShift {
          0%, 100% { transform: translate(0,0); filter: hue-rotate(0deg); }
          20% { transform: translate(1px,-0.5px) skew(0.2deg); }
          40% { transform: translate(-0.5px,1px); }
          60% { filter: hue-rotate(4deg) saturate(1.2); }
        }
        @keyframes sweepBar {
          0% { transform: translateX(-100%); opacity: 0.15; }
          2% { transform: translateX(0); opacity: 0.4; }
          4% { transform: translateX(100%); opacity: 0.15; }
          4.01%, 100% { transform: translateX(100%); opacity: 0.02; }
        }
        `}
      </style>
      <div
        className="pointer-events-none fixed inset-0 -z-10 [animation:sweepBar_60s_linear_infinite]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.10) 35%, rgba(0,0,0,0) 60%)" }}
        key={scanKey}
        aria-hidden
      />

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black italic tracking-tight text-white">IRS Guardian</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400/90">AI compliance · Pub 1828 heuristics</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
        <button
          type="button"
          onClick={() => {
            if (txRows.length > 0) void runEngine();
          }}
          className="rounded-full border border-cyan-500/30 bg-cyan-950/30 px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-900/40"
        >
          Run scan now
        </button>
        <div className="w-full max-w-sm space-y-2 sm:text-right">
          <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Board / compliance inbox</label>
          <input
            value={inbox}
            onChange={(e) => setInbox(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 font-mono text-sm text-cyan-100 outline-none focus:border-cyan-500/50"
            placeholder="compliance@church.org"
          />
        </div>
        </div>
      </div>

      <CompliancePulse openCount={activeTotal} lastScan={lastScan} scanning={scanning} />
      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}

      <p className="mt-2 text-xs text-zinc-500">
        UBI YTD (modeled from ledger flags): {totalU.toLocaleString("en-US", { style: "currency", currency: "USD" })} · Lobbying-like spend (keyword):{" "}
        {lobY.toLocaleString("en-US", { style: "currency", currency: "USD" })}
      </p>

      <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Statement and media intervention gate">
        <div className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/90">Intervention gate — streaming & public copy</h2>
          <p className="text-xs text-zinc-500">
            Public stream titles, YouTube descriptions, and ad/social copy are scanned strictly. For <strong>internal-only</strong> sermon transcripts, use
            the toggle below (product rule: 2026 NRB / internal-disclaimer lane — not legal advice). For ledger lines, set{" "}
            <code className="text-cyan-200/80">metadata.compliance_channel = &quot;internal_worship&quot;</code> to skip political keyword flags on that
            entry.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="text-zinc-500">This paste is:</span>
            <button
              type="button"
              onClick={() => setStatementScanAudience("public")}
              className={
                statementScanAudience === "public"
                  ? "rounded-full bg-cyan-500/20 px-3 py-1 font-bold text-cyan-200 ring-1 ring-cyan-500/40"
                  : "rounded-full border border-zinc-700 px-3 py-1 text-zinc-400"
              }
            >
              Public / stream / social
            </button>
            <button
              type="button"
              onClick={() => setStatementScanAudience("internal")}
              className={
                statementScanAudience === "internal"
                  ? "rounded-full bg-violet-500/20 px-3 py-1 font-bold text-violet-200 ring-1 ring-violet-500/40"
                  : "rounded-full border border-zinc-700 px-3 py-1 text-zinc-400"
              }
            >
              Internal-only (no scan)
            </button>
          </div>
          <input
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            placeholder="Stream / sermon title"
            className="w-full rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-zinc-100"
          />
          <textarea
            value={streamDescription}
            onChange={(e) => setStreamDescription(e.target.value)}
            rows={4}
            placeholder="Long description (YouTube, LiveKit room topic, show notes)…"
            className="w-full rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-zinc-100"
          />
          <textarea
            value={streamMetadataJson}
            onChange={(e) => setStreamMetadataJson(e.target.value)}
            rows={3}
            placeholder='Metadata JSON, e.g. {"ad_unit":"sponsor","obs_tags":"rally, election, youth"}'
            className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-xs text-cyan-100/90"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                let metadata: Record<string, unknown> = {};
                try {
                  metadata = streamMetadataJson.trim() ? (JSON.parse(streamMetadataJson) as Record<string, unknown>) : {};
                } catch {
                  setErr("Metadata must be valid JSON, or use {} for empty.");
                  return;
                }
                setErr(null);
                setStatementHits(
                  scanStreamMetadata(
                    { title: streamTitle, description: streamDescription, metadata },
                    { audience: statementScanAudience }
                  ) as StatementViolation[]
                );
              }}
              className="rounded-full bg-cyan-500/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-cyan-200 ring-1 ring-cyan-500/30 hover:bg-cyan-500/30"
            >
              Run statement monitor
            </button>
            <button
              type="button"
              onClick={() => {
                setStreamTitle("");
                setStreamDescription("");
                setStreamMetadataJson("{}");
                setStatementHits([]);
              }}
              className="rounded-full border border-zinc-700 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"
            >
              Clear
            </button>
          </div>
        </div>
        <div>
          <ComplianceRadar violations={statementHits} />
        </div>
      </section>

      <h2 className="mt-10 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">Ledger — transaction engine</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[880px] table-fixed border-separate border-spacing-y-1 text-left text-xs">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
              <th className="w-28 p-2">Date</th>
              <th className="p-2">Narration</th>
              <th className="w-32 p-2">IRS / UBI</th>
              <th className="w-28 p-2">Amount</th>
              <th className="w-40 p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {txRows.length === 0 && !err ? (
              <tr>
                <td colSpan={5} className="p-4 text-zinc-500">
                  No transactions for this tenant yet.
                </td>
              </tr>
            ) : null}
            {txRows.map((r) => {
              const t = withDesc(r);
              const vlist = violMap[r.id] ?? [];
              const has = vlist.length > 0;
              return (
                <tr key={r.id} className="align-top text-zinc-200">
                  <td colSpan={5} className="p-0">
                    <GlitchRow active={has}>
                      <div className="grid grid-cols-5 gap-1 p-2.5 [font-size:0.7rem] sm:gap-2 sm:text-sm">
                        <div className="sm:w-auto font-mono text-zinc-300">{r.created_at?.slice(0, 10)}</div>
                        <div className="break-words text-zinc-100">{t.description || "—"}</div>
                        <div className="text-zinc-400">
                          {r.irs_category} {r.is_ubi ? "· UBI" : ""}
                        </div>
                        <div className="font-mono text-cyan-200">
                          {Number(r.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </div>
                        <div className="text-right">
                          {vlist.length === 0 ? (
                            <span className="text-zinc-500">—</span>
                          ) : (
                            <ul className="text-right text-[9px]">
                              {vlist.map((v) => (
                                <li key={v.code} className="text-red-400">
                                  <button
                                    type="button"
                                    className="text-left text-red-300 underline decoration-red-500/30 underline-offset-2"
                                    onClick={() => setSelected({ tx: r, v })}
                                  >
                                    {v.code}
                                  </button>{" "}
                                  <span className="text-zinc-500">({v.risk})</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </GlitchRow>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-10">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/80">Audit log — alert history</h2>
        <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-zinc-800 bg-black/30">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-zinc-900/50 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Code</th>
                <th className="p-2">Type</th>
                <th className="p-2">Emailed</th>
                <th className="p-2">Resolved</th>
                <th className="p-2">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-zinc-500">
                    No compliance alerts logged yet. Run a scan to populate.
                  </td>
                </tr>
              ) : null}
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="p-2 font-mono text-zinc-400">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono text-cyan-200">{a.violation_code}</td>
                  <td className="max-w-[200px] truncate p-2" title={a.violation_type}>
                    {a.violation_type}
                  </td>
                  <td className="p-2 text-zinc-500">{a.email_sent_at ? new Date(a.email_sent_at).toLocaleString() : "—"}</td>
                  <td className="p-2 text-zinc-500">{a.resolved_at ? new Date(a.resolved_at).toLocaleString() : "—"}</td>
                  <td className="p-2 text-red-200/80">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dbOpen > 0 && (
          <p className="mt-1 text-[10px] text-zinc-500">
            Open in database (before resolution): {dbOpen} — new scan respects resolved rows in the UI, but the underlying data still drives detection until books are corrected.
          </p>
        )}
      </section>

      <AnimatePresence>
        {selected ? (
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-cyan-500/20 bg-zinc-950/95 p-6 text-sm shadow-[-12px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            role="dialog"
            aria-label="Violation detail"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-red-500">Red team · compliance</p>
            <h2 className="mt-1 text-lg font-bold text-white">{selected.v.type}</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Code: {selected.v.code}</p>
            <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-3 text-xs leading-relaxed text-zinc-300">
              {selected.v.description}
            </div>
            <h3 className="mt-6 text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-500/80">Reference (summary)</h3>
            {IRS_PUB_1828_SNIPS[selected.v.irsRef] ? (
              <div className="mt-1 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs leading-relaxed text-zinc-200">
                <p className="text-[9px] font-bold text-cyan-200">{IRS_PUB_1828_SNIPS[selected.v.irsRef].head}</p>
                <p className="mt-1 text-zinc-400">{IRS_PUB_1828_SNIPS[selected.v.irsRef].text}</p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">No excerpt loaded for this key. See IRS Pub 1828 in full and your tax advisor.</p>
            )}
            <div className="mt-4 text-xs text-zinc-500">
              <p className="text-[9px] font-bold uppercase text-zinc-500">Remedial step</p>
              <p className="text-zinc-300">{selected.v.correction}</p>
            </div>
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <label className="text-[9px] font-bold uppercase text-zinc-500">Board resolution / note (optional)</label>
              <textarea
                className="mt-1 w-full min-h-20 rounded-xl border border-zinc-800 bg-black/40 p-2 text-zinc-200"
                id="res-note"
                defaultValue=""
                placeholder="e.g. Ratified 10/1 board meeting — survey attached in Sovereign Vault"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const el = document.getElementById("res-note") as HTMLTextAreaElement | null;
                  await onResolve(el?.value ?? "");
                }}
                disabled={resolving}
                className="rounded-full bg-cyan-400 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black"
              >
                {resolving ? "…" : "Mark resolved (board log)"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-zinc-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"
              >
                Close
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
