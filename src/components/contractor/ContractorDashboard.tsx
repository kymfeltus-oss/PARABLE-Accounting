"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { PRELOAD_CONTRACTOR_CATEGORIES } from "@/lib/contractorCategories";
import { buildNecBatchDocumentHtml } from "@/lib/contractorNecBatchPrint";
import { computeContractorYtdByPayee } from "@/lib/contractorYtdFromLedger";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { NEC_TRACKING_THRESHOLD_USD } from "../../../contractorTracker.js";
import ContractorWatchdog from "./ContractorWatchdog";

type Payee = {
  id: string;
  display_name: string;
  payee_type: string;
  service_category: string;
  w9_on_file: boolean;
  w9_document_url: string | null;
  notes: string | null;
};

const PAYEE_LABEL: Record<string, string> = {
  sole_proprietor: "Sole proprietorship",
  single_member_llc: "LLC (single-member)",
  multi_member_llc: "LLC (multi-member / partnership-taxed)",
  partnership: "Partnership",
  c_corporation: "C corporation",
  s_corporation: "S corporation",
  unclassified: "Unclassified",
};

export default function ContractorDashboard() {
  const year = new Date().getFullYear();
  const supabase = getSupabaseBrowser();
  const { tenant, ready: brandReady, error: brandError } = useBrand();
  const [payees, setPayees] = useState<Payee[]>([]);
  const [ytd, setYtd] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "err">("loading");
  const [formOpen, setFormOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState<Payee["payee_type"]>("unclassified");
  const [fCat, setFCat] = useState<Payee["service_category"]>("other");
  const [fW9, setFW9] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoadState(brandReady ? "ok" : "loading");
      if (brandReady) setErr(brandError ?? "Tenant not loaded.");
      setPayees([]);
      return;
    }
    setLoadState("loading");
    setErr(null);
    try {
      const [{ data, error: pe }, ymap] = await Promise.all([
        supabase
          .schema("parable_ledger")
          .from("contractor_payees")
          .select("id, display_name, payee_type, service_category, w9_on_file, w9_document_url, notes")
          .eq("tenant_id", tenant.id)
          .order("display_name"),
        computeContractorYtdByPayee(supabase, tenant.id, year),
      ]);
      if (pe) throw new Error(pe.message);
      setPayees((data ?? []) as Payee[]);
      setYtd(ymap);
      setLoadState("ok");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
      setLoadState("err");
    }
  }, [supabase, tenant, year, brandReady, brandError]);

  useEffect(() => {
    void load();
  }, [load]);

  const anyOverThreshold = payees.some((p) => (ytd[p.id] ?? 0) >= NEC_TRACKING_THRESHOLD_USD);

  const onBatch = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = payees
      .map((p) => {
        const t = ytd[p.id] ?? 0;
        if (t < NEC_TRACKING_THRESHOLD_USD) return null;
        return {
          name: p.display_name,
          ytd: t,
          w9OnFile: p.w9_on_file,
          entity: PAYEE_LABEL[p.payee_type] ?? p.payee_type,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    w.document.write(
      buildNecBatchDocumentHtml(
        tenant?.legal_name || tenant?.display_name || "Organization",
        year,
        rows,
      ),
    );
    w.document.close();
    w.focus();
    w.print();
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !tenant?.id || !fName.trim()) return;
    const { error: insErr } = await supabase.schema("parable_ledger").from("contractor_payees").insert({
      tenant_id: tenant.id,
      display_name: fName.trim(),
      payee_type: fType,
      service_category: fCat,
      w9_on_file: fW9,
    });
    if (insErr) {
      setErr(insErr.message);
      return;
    }
    setFName("");
    setFormOpen(false);
    await load();
  };

  if (!brandReady) return <p className="text-sm text-white/45">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 text-white">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40">Parable · 1099-NEC</p>
        <h1
          className="mt-2 text-2xl font-black uppercase italic tracking-tight sm:text-3xl"
          style={{ textShadow: "0 0 32px color-mix(in srgb, var(--brand-cyber) 22%, transparent)" }}
        >
          Contractor & maintenance watchdog
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">
          Track guest speakers, maintenance, sound tech, and pro services. The{" "}
          <strong className="text-white/80">${NEC_TRACKING_THRESHOLD_USD.toLocaleString()}</strong> mark is a{" "}
          <em>boardroom watch</em> — IRS rules and box thresholds (often <strong className="text-amber-200/90">$600</strong> in many
          cases) still apply. CPA review.
        </p>
      </header>

      {err ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {err} — run migration <code className="text-white/80">20250423290000_contractor_payees.sql</code> if the table is missing;
          expenses must set <code className="text-white/80">metadata.contractor_payee_id</code>.
        </p>
      ) : null}

      <section
        className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4"
        style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand-cyber) 8%, transparent)" }}
      >
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/80">CFO: corporation filter (simplistic)</h2>
        <p className="mt-1 text-sm text-white/60">
          Payments to a <strong>corporation</strong> (e.g. “John Doe Plumbing, Inc.”) are often <em>excluded</em> from 1099-NEC in
          common fact patterns, while a <strong>sole prop</strong> or many <strong>LLCs</strong> may be reportable. Legal and some
          professional payees can be an exception. This is not legal advice — the UI is a nudge, not a determination.
        </p>
      </section>

      <ContractorWatchdog payees={payees} ytd={ytd} year={year} onRefresh={load} />

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Pre-loaded 1099-NEC lanes (white label)</h2>
        <ul className="mt-3 space-y-2 text-sm text-white/70">
          {PRELOAD_CONTRACTOR_CATEGORIES.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-[10px] text-white/40">{c.form}</span>
              <span className="text-white/90">{c.label}</span>
              {c.note ? <span className="text-[11px] text-amber-200/80">· {c.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">Vendors (non-employee service)</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase text-white/80 hover:bg-white/10"
          >
            Add payee
          </button>
          <button
            type="button"
            disabled={!anyOverThreshold}
            onClick={onBatch}
            className="rounded-xl border border-[color:rgb(var(--brand-cyber-rgb)/0.4)] bg-[color:rgb(var(--brand-cyber-rgb)/0.1)] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[var(--brand-cyber)] hover:bg-[color:rgb(var(--brand-cyber-rgb)/0.2)] disabled:cursor-not-allowed disabled:opacity-30"
            title="Only for rows at or over the $2,000 watch in YTD"
          >
            Generate 1099-NEC batch
          </button>
        </div>
      </div>

      {formOpen ? (
        <form
          onSubmit={onAdd}
          className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4"
        >
          <input
            value={fName}
            onChange={(e) => setFName(e.target.value)}
            placeholder="Vendor / DBA"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] text-white/50">
              Payee / entity
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm"
                value={fType}
                onChange={(e) => setFType(e.target.value as Payee["payee_type"])}
              >
                {Object.entries(PAYEE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] text-white/50">
              Service lane
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm"
                value={fCat}
                onChange={(e) => setFCat(e.target.value as Payee["service_category"])}
              >
                <option value="other">Other</option>
                <option value="guest_speaker">Guest / pulpit</option>
                <option value="maintenance">Maintenance</option>
                <option value="audio_engineer">Audio / musicians</option>
                <option value="legal">Legal / pro</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={fW9} onChange={(e) => setFW9(e.target.checked)} />
            W-9 in vault
          </label>
          <button
            type="submit"
            className="w-full rounded-xl py-2 text-sm font-bold uppercase text-black"
            style={{ background: "var(--brand-cyber)" }}
          >
            Save
          </button>
        </form>
      ) : null}

      {loadState === "loading" && payees.length === 0 ? <p className="text-sm text-white/40">Scanning sub-ledgers…</p> : null}
    </div>
  );
}
