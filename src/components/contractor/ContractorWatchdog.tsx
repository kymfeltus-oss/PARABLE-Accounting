"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { assessVendorNec, isCorporateLikelyExemptFromNecPayerObligation, NEC_TRACKING_THRESHOLD_USD } from "../../../contractorTracker.js";
import { PRELOAD_CONTRACTOR_CATEGORIES } from "@/lib/contractorCategories";

export type WatchdogPayee = {
  id: string;
  display_name: string;
  payee_type: string;
  service_category: string;
  w9_on_file: boolean;
  w9_document_url: string | null;
  notes: string | null;
};

const PAYEE_LABEL: Record<string, string> = {
  sole_proprietor: "Sole prop",
  single_member_llc: "LLC (SMLLC)",
  multi_member_llc: "LLC (MMLLC)",
  partnership: "Partnership",
  c_corporation: "C corporation",
  s_corporation: "S corporation",
  unclassified: "Unclassified",
};

const TT = {
  corp: "Nudge, not a rule: C/S corporations are often off your 1099-NEC list—confirm the facts and your CPA’s read.",
  bar: "Internal $2,000 watch toward filing prep—federal box thresholds (often $600) differ.",
  expense: "Posts an expense to the ledger; metadata links this vendor for YTD 1099 tracking.",
} as const;

type FundOpt = { id: string; fund_name: string; fund_code: string | null };

type Props = {
  payees: WatchdogPayee[];
  ytd: Record<string, number>;
  year: number;
  onRefresh: () => void | Promise<void>;
};

/**
 * Data grid + $2,000 watch bars + corporation toggle + quick expense (metadata.contractor_payee_id).
 * Tech-noir; tooltips stay in a “simplistic nudge” tone.
 */
export default function ContractorWatchdog({ payees, ytd, year, onRefresh }: Props) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useBrand();
  const [funds, setFunds] = useState<FundOpt[]>([]);
  const [expFund, setExpFund] = useState<string>("");
  const [expContractor, setExpContractor] = useState<string>("");
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");
  const [expErr, setExpErr] = useState<string | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);
  const [expBusy, setExpBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);

  const loadFunds = useCallback(async () => {
    if (!supabase || !tenant?.id) return;
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("ministry_funds")
      .select("id, fund_name, fund_code")
      .eq("tenant_id", tenant.id)
      .order("fund_code", { ascending: true })
      .limit(40);
    if (!error && data?.length) {
      setFunds(data as FundOpt[]);
      setExpFund((prev) => (prev && data.some((d) => d.id === prev) ? prev : data[0].id));
    }
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void loadFunds();
  }, [loadFunds]);

  useEffect(() => {
    if (payees.length > 0 && !expContractor) setExpContractor(payees[0].id);
  }, [payees, expContractor]);

  const setCorporation = async (p: WatchdogPayee, next: boolean) => {
    if (!supabase || !tenant?.id) return;
    setToggleBusy(p.id);
    setOpErr(null);
    try {
      const payee_type = next ? "c_corporation" : "unclassified";
      const { error } = await supabase
        .schema("parable_ledger")
        .from("contractor_payees")
        .update({ payee_type, updated_at: new Date().toISOString() })
        .eq("id", p.id)
        .eq("tenant_id", tenant.id);
      if (error) throw new Error(error.message);
      await onRefresh();
    } catch (e) {
      setOpErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setToggleBusy(null);
    }
  };

  const onLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !tenant?.id) return;
    setExpErr(null);
    const amt = Number(expAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setExpErr("Enter a positive amount.");
      return;
    }
    if (!expContractor) {
      setExpErr("Pick a contractor from the roster.");
      return;
    }
    if (!expFund) {
      setExpErr("Select a fund (or run COA / genesis migration).");
      return;
    }
    const payee = payees.find((p) => p.id === expContractor);
    setExpBusy(true);
    try {
      const { error } = await supabase.schema("parable_ledger").from("transactions").insert({
        tenant_id: tenant.id,
        fund_id: expFund,
        amount: Math.round(amt * 100) / 100,
        tx_type: "expense",
        source: payee ? `Vendor: ${payee.display_name} (${year})` : "Contractor expense",
        is_tax_deductible: true,
        contribution_nature: "charitable_gift",
        irs_category: "Nonprofit expense — vendor (1099 watch)",
        metadata: {
          contractor_payee_id: expContractor,
          service_vendor: true,
          memo: expNote.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      setExpAmount("");
      setExpNote("");
      await onRefresh();
    } catch (er) {
      setExpErr(er instanceof Error ? er.message : "Could not post");
    } finally {
      setExpBusy(false);
    }
  };

  if (payees.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-zinc-500" aria-label="Contractor watchlist">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Watchdog list</h2>
        <p className="mt-2">Add a payee above, then the grid appears here. Expense rows should carry metadata.contractor_payee_id to roll into YTD.</p>
      </section>
    );
  }

  return (
    <section
      className="space-y-5 rounded-2xl border border-white/10 bg-zinc-950/50 p-1 sm:p-0"
      style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand-cyber) 6%, transparent), 0 0 40px rgba(0,0,0,0.4)" }}
      aria-label="Contractor watchdog data grid"
    >
      {opErr ? (
        <p className="mx-1 mb-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100/90" role="status">
          {opErr}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-white/5 max-sm:mx-1">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm text-white/90">
          <caption className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-cyan-500/60">
            Watchdog list — YTD {year} · {NEC_TRACKING_THRESHOLD_USD.toLocaleString()} product watch
          </caption>
          <thead>
            <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest text-zinc-500">
              <th className="px-3 py-2 font-semibold">Vendor</th>
              <th className="px-3 py-2 font-semibold" title={TT.corp}>
                Corporation (exempt nudge)
              </th>
              <th className="min-w-[200px] px-3 py-2 font-semibold" title={TT.bar}>
                Progress → ${NEC_TRACKING_THRESHOLD_USD}
              </th>
              <th className="px-3 py-2 font-semibold">YTD</th>
              <th className="px-3 py-2 font-semibold">W-9</th>
            </tr>
          </thead>
          <tbody>
            {payees.map((p) => {
              const spent = ytd[p.id] ?? 0;
              const a = assessVendorNec({
                ytdUsd: spent,
                w9OnFile: p.w9_on_file,
                payeeType: p.payee_type,
                serviceCategory: p.service_category,
              });
              const isCorp = isCorporateLikelyExemptFromNecPayerObligation(p.payee_type);
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium text-zinc-100">{p.display_name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {PRELOAD_CONTRACTOR_CATEGORIES.find((c) => c.id === p.service_category)?.label ?? p.service_category} ·{" "}
                      {PAYEE_LABEL[p.payee_type] ?? p.payee_type}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-black/50 accent-[var(--brand-cyber)]"
                        checked={isCorp}
                        title={TT.corp}
                        disabled={toggleBusy === p.id}
                        onChange={(e) => void setCorporation(p, e.target.checked)}
                      />
                      <span className="text-[10px] text-zinc-500">{isCorp ? "C/S nudge" : "Off"}</span>
                    </label>
                  </td>
                  <td className="px-3 py-3 align-top" title={TT.bar}>
                    <div
                      className={[
                        "h-2.5 overflow-hidden rounded-full border border-white/5 bg-zinc-950",
                        isCorp ? "opacity-40 grayscale" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, a.progress)}%`,
                          background: isCorp
                            ? "linear-gradient(90deg,#3f3f46,#52525b)"
                            : a.uiTone === "red"
                              ? "linear-gradient(90deg,#7f1d1d, #e11d48)"
                              : a.uiTone === "amber" || a.uiTone === "approach"
                                ? "linear-gradient(90deg,#b45309,#facc15)"
                                : "linear-gradient(90deg, color-mix(in srgb, var(--brand-cyber) 35%, #0a0a0a), var(--brand-cyber))",
                        }}
                      />
                    </div>
                    {isCorp ? (
                      <p className="mt-0.5 text-[9px] text-zinc-400" title={TT.corp}>
                        Exempt from 1099-NEC
                        {spent > 0.01 ? " · spend still on record for audit." : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[9px] text-zinc-500 line-clamp-2">{a.copy.headline}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-cyan-100/90 align-top">
                    ${spent.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 align-top text-xs">
                    {p.w9_on_file ? <span className="text-[var(--brand-glow)]">On file</span> : <span className="text-zinc-500">Missing</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="mx-1 mb-1 rounded-2xl border border-white/10 bg-black/35 p-4 sm:mx-0"
        style={{ background: "linear-gradient(195deg, rgba(15,20,30,0.5) 0%, #050505 100%)" }}
      >
        <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Log expense (metadata link)</h3>
        <p className="mt-1 text-xs text-zinc-500" title={TT.expense}>
          Choose the vendor; we set <code className="text-cyan-600/80">metadata.contractor_payee_id</code> on the new expense row.
        </p>
        {expErr ? <p className="mt-2 text-xs text-amber-200/80">{expErr}</p> : null}
        <form onSubmit={onLogExpense} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex-1 min-w-[12rem] text-[10px] text-zinc-500">
            Contractor
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 py-2 pl-2 text-sm text-white"
              value={expContractor}
              onChange={(e) => setExpContractor(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {payees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-full min-w-[7rem] text-[10px] text-zinc-500 sm:w-28">
            Amount
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 font-mono text-sm"
              inputMode="decimal"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="min-w-[10rem] flex-1 text-[10px] text-zinc-500">
            Fund
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 py-2 text-sm"
              value={expFund}
              onChange={(e) => setExpFund(e.target.value)}
            >
              {funds.length === 0 ? <option value="">— load funds —</option> : null}
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fund_code ?? f.id.slice(0, 6)} — {f.fund_name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[8rem] flex-1 text-[10px] text-zinc-500">
            Note (opt.)
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-sm"
              value={expNote}
              onChange={(e) => setExpNote(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={expBusy}
            className="rounded-xl border border-[color:rgb(var(--brand-cyber-rgb)/0.4)] bg-[color:rgb(var(--brand-cyber-rgb)/0.12)] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--brand-cyber)] disabled:opacity-50"
            title={TT.expense}
          >
            {expBusy ? "Posting…" : "Post expense"}
          </button>
        </form>
      </div>
    </section>
  );
}
