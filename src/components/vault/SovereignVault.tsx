"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { documentExpiryUrgency, isGeneralLiabilityCurrentForSeal, type VaultCategory, type VaultRow } from "@/lib/sovereignVaultHealth";
import Link from "next/link";

const PILLARS: {
  category: VaultCategory;
  name: string;
  blurb: string;
  examples: string[];
}[] = [
  { category: "GOVERNANCE", name: "Governance", blurb: "Bylaws, articles, minutes", examples: ["Bylaws", "Articles of incorporation", "Board minutes"] },
  { category: "IRS_TAX", name: "IRS & tax", blurb: "Determination letter, EIN, filings", examples: ["501(c)(3) letter", "EIN (SS-4)", "990 / 990-T archive"] },
  { category: "INSURANCE", name: "Insurance", blurb: "Liability, D&O, property", examples: ["General liability", "D&O", "Property / umbrella"] },
  { category: "FINANCIALS", name: "Financials", blurb: "Audits, year-end, bank packs", examples: ["Audited / reviewed statements", "Annual board packet"] },
  { category: "CONTINUITY", name: "Continuity", blurb: "Succession, key person", examples: ["Succession plan", "Cross-training SOPs", "Emergency signing"] },
  { category: "RISK", name: "Risk", blurb: "Policies, handbooks, safety", examples: ["Child safety", "COI registers"] },
];

type DbRow = VaultRow & {
  id: string;
  file_name: string;
  file_url: string;
  is_board_certified: boolean;
  key_person_role: string | null;
  version_number: number;
  created_at: string;
};

export default function SovereignVault() {
  const { tenant, ready } = useBrand();
  const supabase = getSupabaseBrowser();
  const [rows, setRows] = useState<DbRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { category: VaultCategory }>(null);
  const [form, setForm] = useState({
    file_name: "",
    file_url: "",
    subcategory: "",
    expiration_date: "",
    key_person_role: "",
    is_board_certified: false,
  });

  const glOk = useMemo(() => isGeneralLiabilityCurrentForSeal(rows), [rows]);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("sovereign_vault")
      .select("id, category, subcategory, file_name, file_url, version_number, expiration_date, is_board_certified, key_person_role, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) {
      setErr(error.message.includes("does not exist") ? "Run migration: supabase/migrations/20250423300000_sovereign_vault.sql" : error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as DbRow[]);
    }
    setLoading(false);
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const byCategory = useMemo(() => {
    const m: Partial<Record<string, DbRow[]>> = {};
    for (const r of rows) {
      m[r.category] = m[r.category] ?? [];
      m[r.category]!.push(r);
    }
    return m;
  }, [rows]);

  const addDoc = async () => {
    if (!supabase || !tenant?.id || !modal) return;
    if (!form.file_name.trim() || !form.file_url.trim()) {
      setErr("File name and URL (or storage path) are required.");
      return;
    }
    setErr(null);
    const { error } = await supabase.schema("parable_ledger").from("sovereign_vault").insert({
      tenant_id: tenant.id,
      category: modal.category,
      file_name: form.file_name.trim(),
      file_url: form.file_url.trim(),
      subcategory: form.subcategory.trim() || null,
      expiration_date: form.expiration_date || null,
      key_person_role: modal.category === "CONTINUITY" ? form.key_person_role.trim() || null : null,
      is_board_certified: form.is_board_certified,
      version_number: 1,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setModal(null);
    setForm({ file_name: "", file_url: "", subcategory: "", expiration_date: "", key_person_role: "", is_board_certified: false });
    void load();
  };

  return (
    <div className="min-h-screen p-4 text-zinc-100 sm:p-8" style={{ background: "linear-gradient(180deg,#0a0a0a 0%,#050505 45%,#0a0a0a 100%)" }}>
      <header className="mx-auto max-w-6xl border-b border-white/10 pb-8">
        <p className="text-[9px] font-bold tracking-[0.4em] uppercase" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
          Parable: Ledger
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white sm:text-4xl">Sovereign vault</h1>
            <p className="mt-1 text-sm text-zinc-500">Institutional documents — governance, tax, insurance, financials, succession.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sovereign-close"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:border-cyan-500/40"
            >
              Month-end close
            </Link>
            <span
              className={[
                "rounded-full border px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-widest",
                glOk ? "border-emerald-500/30 text-emerald-200/80" : "border-amber-500/50 text-amber-200/90",
              ].join(" ")}
            >
              GL seal path: {glOk ? "clear" : "expired on-file"}
            </span>
          </div>
        </div>
        {!ready && <p className="mt-4 text-xs text-amber-200/80">Set NEXT_PUBLIC_TENANT_SLUG to load your tenant.</p>}
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      </header>

      {loading ? (
        <p className="mx-auto max-w-6xl pt-10 text-sm text-zinc-500">Loading vault…</p>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 py-8 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const list = byCategory[p.category] ?? [];
            const hasExpired = list.some((d) => documentExpiryUrgency(d.expiration_date) === "expired");
            const hasSoon = list.some((d) => documentExpiryUrgency(d.expiration_date) === "soon");
            return (
              <motion.section
                key={p.name}
                layout
                className="rounded-3xl border p-5 transition"
                style={{
                  borderColor: hasExpired ? "rgba(239,68,68,0.45)" : hasSoon ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)",
                  background: "rgba(11,13,16,0.75)",
                  boxShadow: hasExpired
                    ? "0 0 32px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : hasSoon
                      ? "0 0 28px rgba(245,158,11,0.1), inset 0 1px 0 rgba(255,255,255,0.04)"
                      : "0 0 20px color-mix(in srgb, var(--brand-cyber, #22d3ee) 0.06%, transparent), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-tight text-white">{p.name}</h2>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">{p.blurb}</p>
                  </div>
                  {(hasExpired || hasSoon) && (
                    <span className={`shrink-0 text-[8px] font-bold uppercase ${hasExpired ? "text-red-400" : "text-amber-200/90"}`}>
                      {hasExpired ? "Renew" : "Soon"}
                    </span>
                  )}
                </div>
                <ul className="mt-2 space-y-0.5 text-[10px] text-zinc-500">
                  {p.examples.map((e) => (
                    <li key={e}>· {e}</li>
                  ))}
                </ul>
                <ul className="mt-4 max-h-44 space-y-2 overflow-auto text-sm">
                  {list.length === 0 ? (
                    <li className="text-xs text-zinc-600">No files yet.</li>
                  ) : (
                    list.map((d) => {
                      const u = documentExpiryUrgency(d.expiration_date);
                      return (
                        <li
                          key={d.id}
                          className="rounded-lg border border-white/5 bg-black/30 px-2 py-1.5"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <a href={d.file_url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-xs text-cyan-200/80 hover:underline">
                              {d.file_name}
                            </a>
                            {d.subcategory && <span className="shrink-0 text-[9px] text-zinc-500">{d.subcategory}</span>}
                          </div>
                          {d.key_person_role && <p className="text-[9px] text-zinc-500">Key person: {d.key_person_role}</p>}
                          {d.expiration_date && (
                            <p
                              className={[
                                "text-[9px] font-mono",
                                u === "expired" ? "text-red-400" : u === "soon" ? "text-amber-200" : "text-zinc-500",
                              ].join(" ")}
                            >
                              Expires {d.expiration_date}
                              {u === "soon" ? " · under 30d" : ""}
                              {u === "expired" ? " · EXPIRED" : ""}
                            </p>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setModal({ category: p.category });
                    setForm((f) => ({ ...f, subcategory: p.category === "INSURANCE" ? "GENERAL_LIABILITY" : "" }));
                  }}
                  className="mt-4 w-full rounded-xl border border-white/10 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300 transition hover:border-cyan-500/40"
                  style={{ color: "var(--brand-cyber, #a5f3fc)" }}
                >
                  + Add document
                </button>
              </motion.section>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-white">Add to {modal.category.replace("_", " ")}</h3>
              <div className="mt-4 space-y-3 text-sm">
                <label className="block text-[10px] uppercase text-zinc-500">
                  File name
                  <input
                    className="mt-1 w-full rounded border border-zinc-800 bg-black/50 px-2 py-1.5"
                    value={form.file_name}
                    onChange={(e) => setForm((f) => ({ ...f, file_name: e.target.value }))}
                  />
                </label>
                <label className="block text-[10px] uppercase text-zinc-500">
                  File URL (signed URL or path)
                  <input
                    className="mt-1 w-full rounded border border-zinc-800 bg-black/50 px-2 py-1.5 font-mono text-xs"
                    value={form.file_url}
                    onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))}
                    placeholder="https://... or storage path"
                  />
                </label>
                <label className="block text-[10px] uppercase text-zinc-500">
                  Subcategory (e.g. GENERAL_LIABILITY)
                  <input
                    className="mt-1 w-full rounded border border-zinc-800 bg-black/50 px-2 py-1.5 font-mono text-xs"
                    value={form.subcategory}
                    onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                  />
                </label>
                <label className="block text-[10px] uppercase text-zinc-500">
                  Expiration
                  <input
                    type="date"
                    className="mt-1 w-full rounded border border-zinc-800 bg-black/50 px-2 py-1.5"
                    value={form.expiration_date}
                    onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))}
                  />
                </label>
                {modal.category === "CONTINUITY" && (
                  <label className="block text-[10px] uppercase text-zinc-500">
                    Key person role
                    <input
                      className="mt-1 w-full rounded border border-zinc-800 bg-black/50 px-2 py-1.5"
                      value={form.key_person_role}
                      onChange={(e) => setForm((f) => ({ ...f, key_person_role: e.target.value }))}
                      placeholder="Lead pastor, CFO, etc."
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.is_board_certified}
                    onChange={(e) => setForm((f) => ({ ...f, is_board_certified: e.target.checked }))}
                  />
                  Mark board-certified
                </label>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-lg border border-zinc-800 py-2 text-xs font-bold uppercase text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void addDoc()}
                  className="flex-1 rounded-lg py-2 text-xs font-bold uppercase text-black"
                  style={{ background: "var(--brand-glow, #22d3ee)" }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
