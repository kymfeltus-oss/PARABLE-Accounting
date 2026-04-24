"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { loadSubledgerForMonthEnd, type MonthEndCloseStatus } from "@/lib/monthEndCloseStatus";
import { getHubPayrollMonth, type HubPayrollSource } from "@/lib/payrollFromErpTable";
import { evaluateApW9Compliance, type ApW9Compliance } from "@/lib/apW9Compliance";
import { loadHousingShieldForHub } from "@/lib/housingHubStatus";
import Link from "next/link";
import MonthEndClose from "./MonthEndClose";
import PlaidLinkPanel from "./PlaidLinkPanel";
import ParablePayArLiveFeed from "./ParablePayArLiveFeed";
import TitheCheckoutButton from "./TitheCheckoutButton";

function GlassButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/90",
        "backdrop-blur-md shadow-lg transition hover:bg-white/10 hover:shadow-[0_0_24px_rgba(0,242,255,0.12)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

type HubState = "idle" | "loading" | "ok" | "err";

const sourceLabel = (s: HubPayrollSource) =>
  s === "erp_payroll" ? "Source: `erp_payroll`" : "Source: ledger expense (modeled) — add rows to `erp_payroll` to lock this view";

/**
 * Financial hub: payroll (UTC month) from `erp_payroll` + sub-ledger cards for AP/AR. Tech-noir; amber for migration/compliance only.
 */
export default function FinancialHub() {
  const supabase = getSupabaseBrowser();
  const { tenant, ready: brandReady, error: brandError } = useBrand();
  const [state, setState] = useState<HubState>("idle");
  const [hubErr, setHubErr] = useState<string | null>(null);
  const [pay, setPay] = useState<Awaited<ReturnType<typeof getHubPayrollMonth>> | null>(null);
  const [me, setMe] = useState<MonthEndCloseStatus | null>(null);
  const [w9, setW9] = useState<ApW9Compliance | null>(null);
  const [housingHub, setHousingHub] = useState<{
    blockedCount: number;
    ministerCount: number;
    vaultHasHousingResolution: boolean;
    skipped: boolean;
  } | null>(null);
  const [apBusy, setApBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setState("ok");
      setMe(null);
      setPay(null);
      setW9(null);
      setHousingHub(null);
      if (brandReady) setHubErr(brandError ?? "Resolve tenant to load the financial hub.");
      return;
    }
    setState("loading");
    setHubErr(null);
    try {
      const [p, s, hs] = await Promise.all([
        getHubPayrollMonth(supabase, tenant.id),
        loadSubledgerForMonthEnd(supabase, tenant.id),
        loadHousingShieldForHub(supabase, tenant.id),
      ]);
      setPay(p);
      setMe(s);
      setHousingHub({
        blockedCount: hs.blockedCount,
        ministerCount: hs.ministerCount,
        vaultHasHousingResolution: hs.vaultHasHousingResolution,
        skipped: hs.skipped,
      });
      const topPending = s.apRows
        .filter((r) => r.status === "pending")
        .sort((a, b) => {
          const ad = a.due_date ? new Date(a.due_date).getTime() : 0;
          const bd = b.due_date ? new Date(b.due_date).getTime() : 0;
          return ad - bd;
        })
        .slice(0, 3);
      setW9(await evaluateApW9Compliance(supabase, tenant.id, topPending));
      setState("ok");
    } catch (e) {
      setHubErr(e instanceof Error ? e.message : "Failed to load hub data.");
      setState("err");
    }
  }, [supabase, tenant, brandReady, brandError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onApprove = async (id: string) => {
    if (!supabase || !tenant?.id) return;
    setApBusy(id);
    try {
      const { error } = await supabase
        .schema("parable_ledger")
        .from("accounts_payable")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (error) throw new Error(error.message);
      await load();
    } catch (e) {
      setHubErr(e instanceof Error ? e.message : "Could not update bill");
    } finally {
      setApBusy(null);
    }
  };

  const onMarkPaid = async (id: string) => {
    if (!supabase || !tenant?.id) return;
    setApBusy(id);
    try {
      const { error } = await supabase
        .schema("parable_ledger")
        .from("accounts_payable")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (error) throw new Error(error.message);
      await load();
    } catch (e) {
      setHubErr(e instanceof Error ? e.message : "Could not mark paid");
    } finally {
      setApBusy(null);
    }
  };

  const pendingBills = me?.apRows.filter((r) => r.status === "pending") ?? [];
  const approvedUnpaid = me?.apRows.filter((r) => r.status === "approved") ?? [];
  const top3Pending = [...pendingBills]
    .sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : 0;
      const bd = b.due_date ? new Date(b.due_date).getTime() : 0;
      return ad - bd;
    })
    .slice(0, 3);

  const pledgeAr = (me?.arRows ?? []).filter((r) => r.is_restricted);
  const pledgeTotalDue = pledgeAr.reduce((a, r) => a + Math.max(0, Number(r.amount_due) || 0), 0);
  const pledgeTotalPaid = pledgeAr.reduce((a, r) => a + Math.max(0, Math.min(Number(r.amount_due) || 0, Number(r.amount_paid) || 0)), 0);
  const pledgeIntegrityPct = pledgeTotalDue < 0.01 ? 0 : Math.min(100, (pledgeTotalPaid / pledgeTotalDue) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-10 text-white">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40">Parable — ERP</p>
        <h1
          className="mt-2 text-2xl font-black uppercase italic tracking-tight sm:text-3xl"
          style={{ textShadow: "0 0 32px color-mix(in srgb, var(--brand-cyber) 25%, transparent)" }}
        >
          Financial hub
        </h1>
        <p className="mt-2 text-sm text-white/50">Payroll · payables (AP) · receivables (AR) — live sub-ledgers, UTC month.</p>
      </header>

      {hubErr && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {hubErr} If the AP/AR/ERP tables are missing, run{" "}
          <code className="text-white/80">20250423350000_erp_payroll.sql</code>,{" "}
          <code className="text-white/80">20250423280000_erp_subledgers.sql</code> (or db push).
        </div>
      )}

      <section
        className="rounded-3xl border border-cyan-500/15 p-5 sm:p-6"
        style={{ background: "linear-gradient(180deg, rgba(0,242,255,0.04), #080808)" }}
        aria-label="Sovereign financial architecture"
      >
        <h2
          className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300/80"
          style={{ textShadow: "0 0 20px var(--brand-glow-rgb, 34, 211, 238, 0.15)" }}
        >
          Financial architecture
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Stripe (tithes → UCOA 4010 metadata) & Plaid (bank → <code>erp_ledger</code> / unverified import).</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {tenant?.id ? <TitheCheckoutButton tenantId={tenant.id} /> : null}
          <PlaidLinkPanel />
        </div>
      </section>

      {housingHub && !housingHub.skipped && housingHub.ministerCount > 0 && (
        <div
          className={`rounded-2xl border p-3 text-sm ${
            housingHub.blockedCount > 0
              ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
              : "border-white/10 bg-white/[0.04] text-zinc-300"
          }`}
          title="Nudge: written housing allowance before the first excludable pay. Not tax advice."
        >
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
            Ministerial tax shield (hub)
          </p>
          <p className="mt-1">
            {housingHub.blockedCount > 0
              ? `${housingHub.blockedCount} of ${housingHub.ministerCount} minister(s) need the housing nudge (vault file or staff flag) before a comfortable first payroll.`
              : "Housing nudge check passes for the vault query — still verify per employee with counsel before pay run."}
          </p>
          <Link
            className="mt-2 inline-block text-[9px] font-bold uppercase text-cyan-200/80 underline"
            href="/staff-onboarding"
          >
            Staff Genesis →
          </Link>
        </div>
      )}

      <section
        className="rounded-3xl border border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{ background: "linear-gradient(180deg, rgba(34,211,238,0.04), rgba(0,0,0,0.2))" }}
      >
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Payroll (current UTC month)</h2>
        {pay && (
          <p className="mt-1 text-xs text-zinc-500" title="Where totals were computed">
            {sourceLabel(pay.source)} · {pay.monthLabel}
          </p>
        )}
        {state === "loading" && !pay ? <p className="mt-4 text-sm text-white/45">Loading…</p> : null}
        {pay ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--brand-glow)" }}>
                Ministerial housing
              </p>
              <p className="mt-2 font-mono text-2xl text-white/95">${pay.ministerial.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="mt-1 text-[10px] text-zinc-500">From `erp_payroll` (`wage_type = ministerial_housing`) or housing rows on ledger when table empty.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-[10px] font-bold uppercase text-cyan-200/90">Secular wages</p>
              <p className="mt-2 font-mono text-2xl text-white/95">${pay.secular.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="mt-1 text-[10px] text-zinc-500">From `erp_payroll` (`wage_type = secular_wage`) or non-minister wage lines when table empty.</p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-3xl border border-white/10 p-5 sm:p-6"
          style={{ background: "radial-gradient(100% 80% at 50% 0, rgba(255,255,255,0.03) 0, #080808 100%)" }}
        >
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Payables (AP) — sub-ledger</h2>
          <p className="mt-1 text-sm text-zinc-500">Top 3 pending bills (by due date) + W-9 compliance (contractor roster).</p>

          <ul className="mt-4 space-y-2">
            {top3Pending.length === 0 ? (
              <li className="text-sm text-zinc-500">No pending bills. {pendingBills.length + approvedUnpaid.length === 0 ? "Add rows in `accounts_payable`." : ""}</li>
            ) : (
              top3Pending.map((b) => (
                <li key={b.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!b.invoice_url && (
                        <span className="text-zinc-500" title="Invoice PDF not attached">
                          (no PDF)
                        </span>
                      )}
                      <span className="font-medium text-white/90">{b.vendor_name}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      ${Number(b.amount).toFixed(2)} · due {b.due_date ? new Date(b.due_date).toLocaleDateString() : "—"}{" "}
                      <span className="text-cyan-400/80">(pending)</span>
                    </p>
                  </div>
                  <GlassButton onClick={() => void onApprove(b.id)} disabled={apBusy === b.id} className="sm:ml-2">
                    {apBusy === b.id ? "…" : "Approve"}
                  </GlassButton>
                </li>
              ))
            )}
          </ul>

          {w9 && (
            <div
              className={[
                "mt-4 rounded-2xl border px-3 py-2.5 text-xs",
                w9.isBreached
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-400",
              ].join(" ")}
            >
              <p className="font-bold" style={w9.isBreached ? { color: "rgb(250 250 200)" } : { color: "var(--brand-cyber, #22d3ee)" }}>
                Compliance: {w9.label}
              </p>
              <p className="mt-0.5 text-zinc-400/90">{w9.detail}</p>
            </div>
          )}

          {(pendingBills.length > 3 || approvedUnpaid.length > 0) && (
            <p className="mt-3 text-[10px] text-zinc-500">
              +{Math.max(0, pendingBills.length - 3)} more pending · {approvedUnpaid.length} approved · not paid
            </p>
          )}
        </section>

        <section
          className="rounded-3xl border border-white/10 p-5 sm:p-6"
          style={{ background: "radial-gradient(100% 80% at 50% 0, rgba(0,242,255,0.04) 0, #080808 100%)" }}
        >
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Receivables (AR) — sub-ledger</h2>
          <p className="mt-1 text-sm text-zinc-500">Pledge collection integrity (restricted AR vs scheduled)</p>
          <ParablePayArLiveFeed tenantId={tenant?.id} />
          {pledgeAr.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No restricted pledge lines — seed `accounts_receivable` with is_restricted = true.</p>
          ) : (
            <>
              <p className="mt-2 font-mono text-sm text-zinc-400">
                Collected <span className="text-cyan-200/90">${pledgeTotalPaid.toFixed(0)}</span> / scheduled{" "}
                <span className="text-white/70">${pledgeTotalDue.toFixed(0)}</span>
                <span className="ml-2 text-cyan-400/70"> {pledgeIntegrityPct.toFixed(1)}%</span>
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/5 bg-zinc-950">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pledgeIntegrityPct}%`,
                    background: "linear-gradient(90deg, color-mix(in srgb, #22d3ee 50%, #111), #4ade80)",
                    boxShadow: "0 0 14px color-mix(in srgb, #22d3ee 25%, transparent)",
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/40 p-4 sm:p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Full AP workflow</h3>
        <p className="text-xs text-zinc-500">All open lines (not limited to top 3).</p>
        <ul className="mt-3 space-y-2">
          {pendingBills.length === 0 && approvedUnpaid.length === 0 ? <li className="text-sm text-zinc-500">No open AP in pending/approved status.</li> : null}
          {pendingBills.map((b) => (
            <li key={b.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {!b.invoice_url && <span className="text-[9px] text-zinc-500">(no PDF)</span>}
                  <span className="font-medium text-white/90">{b.vendor_name}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  ${Number(b.amount).toFixed(2)} · {b.due_date ? new Date(b.due_date).toLocaleDateString() : "—"}{" "}
                  <span className="text-cyan-400/80">(pending)</span>
                </p>
              </div>
              <GlassButton onClick={() => void onApprove(b.id)} disabled={apBusy === b.id} className="self-start sm:self-center">
                {apBusy === b.id ? "…" : "Approve"}
              </GlassButton>
            </li>
          ))}
          {approvedUnpaid.map((b) => (
            <li key={b.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {!b.invoice_url && <span className="text-[9px] text-zinc-500">(no PDF)</span>}
                  <span className="font-medium text-white/90">{b.vendor_name}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  ${Number(b.amount).toFixed(2)} · {b.due_date ? new Date(b.due_date).toLocaleDateString() : "—"}{" "}
                  <span className="text-cyan-200/70">(approved · not paid)</span>
                </p>
              </div>
              <GlassButton onClick={() => void onMarkPaid(b.id)} disabled={apBusy === b.id}>
                {apBusy === b.id ? "…" : "Mark paid"}
              </GlassButton>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AR line detail (restricted)</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {pledgeAr.length === 0 ? (
            <li className="text-sm text-zinc-500">—</li>
          ) : (
            pledgeAr.map((r) => {
              const due = Math.max(0, Number(r.amount_due) || 0);
              const paid = Math.max(0, Math.min(due, Number(r.amount_paid) || 0));
              const pct = due < 0.01 ? 0 : (paid / due) * 100;
              return (
                <li key={r.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium text-white/90">{r.payer_name}</span>
                    <span className="font-mono text-xs text-zinc-500">
                      ${paid.toFixed(0)} / ${due.toFixed(0)}
                    </span>
                  </div>
                  {r.category && <p className="text-[9px] text-zinc-600">{r.category}</p>}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-900/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-emerald-500/50"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <MonthEndClose
        status={me}
        loading={state === "loading"}
        error={state === "err" && !me ? hubErr : null}
        onRefresh={load}
        onConfirmSeal={() => {
          void 0;
        }}
      />
    </div>
  );
}
