"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { useAuditMode } from "@/context/AuditModeContext";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { getPayrollRange, getTitheRange, type MatrixPayrollPeriod, type MatrixTithePeriod } from "@/lib/dashboardDateRanges";
import { fetchOpenComplianceAlerts, formatUsd, sumErpPayrollRange, sumOrgTitheOfferings, type ErpPayrollBreakdown } from "@/lib/dashboardMetrics";
import {
  loadDashboardMatrixConfig,
  saveDashboardMatrixConfig,
  type DashboardMatrixConfig,
  type WidgetId,
  DEFAULT_WIDGET_ORDER,
} from "@/lib/dashboardWidgetStorage";

const TITHE_PERIODS: { value: MatrixTithePeriod; label: string }[] = [
  { value: "mtd", label: "MTD" },
  { value: "full_month", label: "Full month" },
  { value: "qtd", label: "QTD" },
  { value: "ytd", label: "YTD" },
];

const PAY_PERIODS: { value: MatrixPayrollPeriod; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "qtd", label: "QTD" },
  { value: "ytd", label: "YTD" },
];

const WIDGET_LABEL: Record<WidgetId, string> = {
  tithes: "Tithes & offerings",
  payroll: "Payroll",
  alerts: "Internal controls alerts",
};

/**
 * User-configurable metric matrix (localStorage). Shows tithe/offering rollups, payroll, and open compliance automation alerts.
 */
export default function DashboardWidgetMatrix() {
  const { tenant, ready: brandReady } = useBrand();
  const { auditMode } = useAuditMode();
  const supabase = getSupabaseBrowser();
  const [config, setConfig] = useState<DashboardMatrixConfig | null>(null);
  const [customize, setCustomize] = useState(false);

  useEffect(() => {
    setConfig(loadDashboardMatrixConfig());
  }, []);

  const persist = useCallback((next: DashboardMatrixConfig) => {
    setConfig(next);
    saveDashboardMatrixConfig(next);
  }, []);

  const move = useCallback(
    (id: WidgetId, dir: -1 | 1) => {
      if (!config) return;
      const i = config.order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= config.order.length) return;
      const order = [...config.order];
      [order[i], order[j]] = [order[j]!, order[i]!];
      persist({ ...config, order });
    },
    [config, persist]
  );

  const toggle = useCallback(
    (id: WidgetId) => {
      if (!config) return;
      persist({ ...config, enabled: { ...config.enabled, [id]: !config.enabled[id] } });
    },
    [config, persist]
  );

  if (!config) {
    return (
      <div
        className={[
          "min-h-[120px] rounded-2xl border p-6 text-sm",
          auditMode ? "border-neutral-200 bg-white text-neutral-500" : "border-white/10 bg-black/20 text-white/45",
        ].join(" ")}
      >
        Loading matrix…
      </div>
    );
  }

  const card = auditMode
    ? "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
    : "rounded-2xl border border-white/10 bg-black/30 p-5 shadow-[0_0_0_1px_rgb(var(--brand-cyber-rgb)/0.06)]";

  const sub = auditMode ? "text-neutral-600" : "text-white/50";
  const label = auditMode ? "text-neutral-500" : "text-white/40";
  const title = auditMode ? "text-neutral-900" : "text-white/95";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={["text-[10px] font-bold uppercase tracking-[0.25em]", label].join(" ")}>Your matrix</h2>
          <p className={["mt-1 max-w-2xl text-sm", sub].join(" ")}>
            Pin the metrics you need — saved in this browser. Connect Supabase and tenant to load live tithes, payroll, and
            internal-controls alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCustomize((c) => !c)}
          className={[
            "self-start rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition",
            auditMode
              ? "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
              : "border border-white/12 bg-white/[0.04] text-white/70 hover:border-[rgb(var(--brand-cyber-rgb)/0.35)] hover:text-[var(--brand-cyber)]",
          ].join(" ")}
        >
          {customize ? "Close" : "Customize matrix"}
        </button>
      </div>

      {customize && (
        <div
          className={[
            "space-y-3 rounded-2xl border p-4",
            auditMode ? "border-neutral-200 bg-neutral-50" : "border-white/10 bg-white/[0.03]",
          ].join(" ")}
        >
          <p className={["text-xs font-semibold", title].join(" ")}>Show & order</p>
          <ul className="space-y-2">
            {DEFAULT_WIDGET_ORDER.map((id) => (
              <li
                key={id}
                className={["flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5", auditMode ? "border-neutral-200 bg-white" : "border-white/10 bg-black/20"].join(" ")}
              >
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.enabled[id]}
                    onChange={() => toggle(id)}
                    className="h-3.5 w-3.5 rounded border-white/20"
                  />
                  <span className={title}>{WIDGET_LABEL[id]}</span>
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={
                      auditMode
                        ? "rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
                        : "rounded border border-white/10 px-1.5 py-0.5 text-xs text-white/50 hover:text-[var(--brand-cyber)]"
                    }
                    onClick={() => move(id, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={
                      auditMode
                        ? "rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
                        : "rounded border border-white/10 px-1.5 py-0.5 text-xs text-white/50 hover:text-[var(--brand-cyber)]"
                    }
                    onClick={() => move(id, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {config.order
          .filter((id) => config.enabled[id])
          .map((id) => (
            <li key={id} className="min-w-0">
              {id === "tithes" && (
                <TithesWidget
                  className={card}
                  tithePeriod={config.tithePeriod}
                  onPeriodChange={(tithePeriod) => persist({ ...config, tithePeriod })}
                  tenantId={tenant?.id}
                  brandReady={brandReady}
                  supabase={supabase}
                  auditMode={auditMode}
                />
              )}
              {id === "payroll" && (
                <PayrollWidget
                  className={card}
                  payrollPeriod={config.payrollPeriod}
                  onPeriodChange={(payrollPeriod) => persist({ ...config, payrollPeriod })}
                  tenantId={tenant?.id}
                  brandReady={brandReady}
                  supabase={supabase}
                  auditMode={auditMode}
                />
              )}
              {id === "alerts" && (
                <AlertsWidget
                  className={card}
                  tenantId={tenant?.id}
                  brandReady={brandReady}
                  supabase={supabase}
                  auditMode={auditMode}
                />
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}

function TithesWidget({
  className,
  tithePeriod,
  onPeriodChange,
  tenantId,
  brandReady,
  supabase,
  auditMode,
}: {
  className: string;
  tithePeriod: MatrixTithePeriod;
  onPeriodChange: (p: MatrixTithePeriod) => void;
  tenantId: string | undefined;
  brandReady: boolean;
  supabase: ReturnType<typeof getSupabaseBrowser>;
  auditMode: boolean;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const [lines, setLines] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getTitheRange(tithePeriod), [tithePeriod]);

  useEffect(() => {
    if (!supabase || !tenantId || !brandReady) {
      setTotal(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      const r = await sumOrgTitheOfferings(supabase, tenantId, range.start, range.end);
      if (cancel) return;
      if (r.error) setErr(r.error);
      setTotal(r.total);
      setLines(r.lineCount);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [supabase, tenantId, brandReady, range.start, range.end]);

  const sub = auditMode ? "text-neutral-600" : "text-white/50";
  const label = auditMode ? "text-neutral-500" : "text-white/40";
  const title = auditMode ? "text-neutral-900" : "text-white/95";
  const mono = auditMode ? "text-neutral-800" : "text-white/90";

  return (
    <div className={className}>
      <p className={["text-[9px] font-bold uppercase tracking-[0.2em]", label].join(" ")}>Tithes & offerings</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className={["text-sm font-bold", title].join(" ")}>Org total</h3>
        <select
          value={tithePeriod}
          onChange={(e) => onPeriodChange(e.target.value as MatrixTithePeriod)}
          className={[
            "max-w-[10rem] rounded-md border py-1 pl-2 pr-6 text-[10px] font-bold uppercase tracking-wider",
            auditMode ? "border-neutral-300 bg-white text-neutral-800" : "border-white/15 bg-black/40 text-white/80",
          ].join(" ")}
        >
          {TITHE_PERIODS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className={["mt-1 text-[10px]", sub].join(" ")}>{range.label} · {new Date(range.start).toLocaleDateString()} → {new Date(range.end).toLocaleDateString()}</p>
      {err ? (
        <p className="mt-2 text-xs text-amber-300/90">{err}</p>
      ) : !brandReady || !tenantId ? (
        <p className={["mt-3 text-xs", sub].join(" ")}>Set tenant (slug) to load.</p>
      ) : loading ? (
        <p className={["mt-3 font-mono text-2xl", mono].join(" ")}>—</p>
      ) : (
        <>
          <p className={["mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight", auditMode ? "text-neutral-900" : "text-[var(--brand-cyber)]"].join(" ")}>{formatUsd(total ?? 0)}</p>
          <p className={["mt-1 text-[10px]", sub].join(" ")}>{lines} line(s) · donation + revenue</p>
        </>
      )}
    </div>
  );
}

function PayrollWidget({
  className,
  payrollPeriod,
  onPeriodChange,
  tenantId,
  brandReady,
  supabase,
  auditMode,
}: {
  className: string;
  payrollPeriod: MatrixPayrollPeriod;
  onPeriodChange: (p: MatrixPayrollPeriod) => void;
  tenantId: string | undefined;
  brandReady: boolean;
  supabase: ReturnType<typeof getSupabaseBrowser>;
  auditMode: boolean;
}) {
  const [data, setData] = useState<ErpPayrollBreakdown | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const range = useMemo(() => getPayrollRange(payrollPeriod), [payrollPeriod]);

  useEffect(() => {
    if (!supabase || !tenantId || !brandReady) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      const r = await sumErpPayrollRange(supabase, tenantId, range.start, range.end, new Date());
      if (cancel) return;
      if (r.error) setErr(r.error);
      setData(r);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [supabase, tenantId, brandReady, range.start, range.end]);

  const sub = auditMode ? "text-neutral-600" : "text-white/50";
  const label = auditMode ? "text-neutral-500" : "text-white/40";
  const title = auditMode ? "text-neutral-900" : "text-white/95";
  const mono = auditMode ? "text-neutral-800" : "text-white/90";

  return (
    <div className={className}>
      <p className={["text-[9px] font-bold uppercase tracking-[0.2em]", label].join(" ")}>Payroll</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className={["text-sm font-bold", title].join(" ")}>Wages (ERP)</h3>
        <select
          value={payrollPeriod}
          onChange={(e) => onPeriodChange(e.target.value as MatrixPayrollPeriod)}
          className={[
            "max-w-[9rem] rounded-md border py-1 pl-2 pr-6 text-[10px] font-bold uppercase tracking-wider",
            auditMode ? "border-neutral-300 bg-white text-neutral-800" : "border-white/15 bg-black/40 text-white/80",
          ].join(" ")}
        >
          {PAY_PERIODS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className={["mt-1 text-[10px]", sub].join(" ")}>{range.label} · {range.start} → {range.end}</p>
      {err && <p className="mt-2 text-xs text-amber-300/90">{err}</p>}
      {!brandReady || !tenantId ? (
        <p className={["mt-3 text-xs", sub].join(" ")}>Set tenant to load.</p>
      ) : loading ? (
        <p className={["mt-3 font-mono", mono].join(" ")}>—</p>
      ) : data ? (
        <div className="mt-3 space-y-1.5">
          <p className={["font-mono text-sm tabular-nums", mono].join(" ")}>Housing: {formatUsd(data.ministerial)}</p>
          <p className={["font-mono text-sm tabular-nums", mono].join(" ")}>Secular: {formatUsd(data.secular)}</p>
          <p className={["text-[10px] uppercase", sub].join(" ")}>source: {data.source} · {data.lineCount} row(s)</p>
        </div>
      ) : null}
    </div>
  );
}

function AlertsWidget({
  className,
  tenantId,
  brandReady,
  supabase,
  auditMode,
}: {
  className: string;
  tenantId: string | undefined;
  brandReady: boolean;
  supabase: ReturnType<typeof getSupabaseBrowser>;
  auditMode: boolean;
}) {
  const [openCount, setOpenCount] = useState(0);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchOpenComplianceAlerts>>["rows"]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !tenantId || !brandReady) {
      setOpenCount(0);
      setRows([]);
      return;
    }
    let cancel = false;
    void (async () => {
      const r = await fetchOpenComplianceAlerts(supabase, tenantId, 5);
      if (cancel) return;
      if (r.error) setErr(r.error);
      setOpenCount(r.openCount);
      setRows(r.rows);
    })();
    return () => {
      cancel = true;
    };
  }, [supabase, tenantId, brandReady]);

  const sub = auditMode ? "text-neutral-600" : "text-white/50";
  const label = auditMode ? "text-neutral-500" : "text-white/40";
  const title = auditMode ? "text-neutral-900" : "text-white/95";
  const crit = "text-amber-300/95";

  return (
    <div className={className}>
      <p className={["text-[9px] font-bold uppercase tracking-[0.2em]", label].join(" ")}>Internal controls</p>
      <h3 className={["mt-1 text-sm font-bold", title].join(" ")}>Automation alerts</h3>
      <p className={["mt-1 text-[10px] leading-relaxed", sub].join(" ")}>From IRS Guardian / compliance pipeline — not resolved.</p>
      {err && <p className="mt-2 text-xs text-amber-300/90">{err}</p>}
      {!brandReady || !tenantId ? (
        <p className={["mt-2 text-xs", sub].join(" ")}>Set tenant to load.</p>
      ) : (
        <>
          <p className={["mt-3 font-mono text-2xl font-bold tabular-nums", crit].join(" ")}>{openCount} open</p>
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-left">
            {rows.length === 0 && openCount === 0 && (
              <li className={["text-xs", sub].join(" ")}>No open flags — or table empty (run Guardian).</li>
            )}
            {rows.map((r) => (
              <li
                key={r.id}
                className={[
                  "rounded-md border px-2 py-1.5 text-[10px] leading-snug",
                  auditMode ? "border-neutral-100 bg-neutral-50 text-neutral-800" : "border-white/10 bg-black/25 text-white/80",
                ].join(" ")}
                title={r.description}
              >
                <span className="font-mono text-[9px] text-amber-200/90">{r.violation_code || r.risk_level}</span> — {r.violation_type}
              </li>
            ))}
          </ul>
          <Link
            href="/compliance"
            className={["mt-2 inline-block text-xs font-semibold underline-offset-2 hover:underline", auditMode ? "text-blue-800" : "text-[var(--brand-cyber)]"].join(" ")}
          >
            Open compliance cockpit →
          </Link>
        </>
      )}
    </div>
  );
}
