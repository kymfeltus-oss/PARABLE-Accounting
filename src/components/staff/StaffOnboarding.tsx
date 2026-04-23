"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import {
  STAFF_SOVEREIGNTY_GATES,
  assessHousingShield,
  draftHousingAllowanceBoardResolution,
  estimateEmployerFicaMatchYtd,
  isVaultRowHousingAllowanceResolution,
} from "@/lib/onboardingFromRoot.js";
import { buildBoardResolutionText } from "@/lib/boardResolutionTemplate";

const GATES_BASE = {
  "1_legal_dna": "pending",
  "2_housing_shield": "pending",
  "3_contractor_shield": "n/a" as const,
  "4_vision_culture": "pending",
};

type StaffRow = {
  id: string;
  full_name: string;
  role_type: "Minister" | "Secular Staff" | "Contractor";
  department: string | null;
  onboarding_status: string;
  has_housing_resolution: boolean;
  tax_form_status: string;
  hire_date: string | null;
  housing_vault_doc_id: string | null;
  gates: Record<string, string>;
};

const CARDS: { key: "Minister" | "Secular Staff" | "Contractor"; title: string; roles: string; shield: string }[] = [
  { key: "Minister", title: "Ministerial", roles: "Pastors, worship leaders", shield: "Housing Allowance (board + vault) before first housing pay" },
  { key: "Secular Staff", title: "Secular staff", roles: "Admin, janitorial", shield: "W-4, I-9, direct deposit; employer FICA match (hub nudge)" },
  { key: "Contractor", title: "Contractors", roles: "Musicians, maintenance", shield: "W-9 & $2,000 1099-NEC internal watchdog" },
];

export default function StaffOnboarding() {
  const supabase = getSupabaseBrowser();
  const { tenant, ready } = useBrand();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [vaultHousing, setVaultHousing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | (typeof CARDS)[0]>(null);
  const [fName, setFName] = useState("");
  const [fDept, setFDept] = useState("");
  const [fHire, setFHire] = useState("");
  const [proposedHousing, setProposedHousing] = useState("18000");
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) return;
    setErr(null);
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("staff_onboarding")
      .select(
        "id, full_name, role_type, department, onboarding_status, has_housing_resolution, tax_form_status, hire_date, housing_vault_doc_id, gates",
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("does not exist") || error.message.includes("staff_onboarding")) {
        setErr("Run migration 20250423360000_staff_onboarding.sql (db push).");
        setRows([]);
        return;
      }
      setErr(error.message);
      return;
    }
    setRows((data ?? []) as StaffRow[]);
    const { data: v } = await supabase
      .schema("parable_ledger")
      .from("sovereign_vault")
      .select("id, category, subcategory, metadata, file_name")
      .eq("tenant_id", tenant.id)
      .limit(200);
    setVaultHousing((v ?? []).some((row) => isVaultRowHousingAllowanceResolution(row as never)));
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const launchJourney = (c: (typeof CARDS)[0]) => {
    setModal(c);
    setFName("");
    setFDept("");
    setFHire(new Date().toISOString().slice(0, 10));
  };

  const onRecruit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !tenant?.id || !modal) return;
    if (!fName.trim()) return;
    setBusy(true);
    setErr(null);
    const gates = {
      ...GATES_BASE,
      "3_contractor_shield": (modal.key === "Contractor" ? "pending" : "n/a") as "pending" | "n/a",
    };
    const { error } = await supabase.schema("parable_ledger").from("staff_onboarding").insert({
      tenant_id: tenant.id,
      full_name: fName.trim(),
      role_type: modal.key,
      department: fDept.trim() || null,
      hire_date: fHire || null,
      onboarding_status: "In_Progress",
      gates,
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    setModal(null);
    await load();
    setBusy(false);
  };

  const buildDraft = () => {
    if (!tenant) return;
    const t = { legal_name: tenant.legal_name, display_name: tenant.display_name, tax_id_ein: (tenant as { tax_id_ein?: string | null }).tax_id_ein };
    const a = buildBoardResolutionText(tenant, {
      fiscalYear: new Date().getFullYear(),
      assemblyDate: new Date().toLocaleDateString("en-US"),
    });
    const b = draftHousingAllowanceBoardResolution(t, {
      proposedAnnualHousingUsd: Number(proposedHousing) || 0,
      assemblyDate: new Date().toLocaleDateString("en-US"),
      fiscalYear: new Date().getFullYear(),
    });
    setDraft(`${a}\n\n--- Extended housing nudge (paralegal-style draft) ---\n\n${b}`);
  };

  if (!ready) return <p className="p-4 text-sm text-zinc-500">Loading…</p>;

  return (
    <div
      className="mx-auto max-w-4xl space-y-8 p-2 text-white sm:p-4"
      style={{ background: "radial-gradient(100% 40% at 50% 0, #0c1220 0%, #050505 55%)" }}
    >
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[#050505] p-6 sm:p-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="text-2xl font-black uppercase italic tracking-tighter sm:text-3xl"
            style={{ textShadow: "0 0 28px color-mix(in srgb, #22d3ee 18%, transparent)" }}
          >
            Staff Genesis
          </h2>
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-400/90">Human capital — sovereignty gates</p>
          <p className="mt-3 text-xs text-zinc-500">Congregation lives in Member Hub; org payroll compliance starts here. Not legal or tax advice.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600" title="Same tenant as the rest of PARABLE">
            Organization
          </span>
          <button
            type="button"
            onClick={() => launchJourney(CARDS[0])}
            className="whitespace-nowrap rounded-full border border-cyan-400/40 bg-cyan-400/10 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          >
            + Recruit new staff
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-100" role="alert">
          {err}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {CARDS.map((type) => (
          <div
            key={type.key}
            className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-500/30"
            style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, white 0.04, transparent)" }}
          >
            <h3 className="text-lg font-bold text-zinc-100">{type.title}</h3>
            <p className="mb-4 text-[9px] uppercase text-zinc-600">{type.roles}</p>
            <div className="mb-4 rounded-xl border border-white/5 bg-black/40 p-3">
              <p className="text-[8px] font-bold uppercase tracking-tighter text-cyan-500/80">Primary compliance shield</p>
              <p className="text-xs leading-snug text-zinc-300/90">{type.shield}</p>
            </div>
            <button
              type="button"
              onClick={() => launchJourney(type)}
              className="w-full rounded-lg border border-white/10 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-200 transition group-hover:border-cyan-500/30 group-hover:bg-white/[0.04] group-hover:text-cyan-200"
            >
              Initialize journey
            </button>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/5 bg-zinc-950/60 p-4 sm:p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sovereignty gates (sequence)</h3>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          {STAFF_SOVEREIGNTY_GATES.map((g) => (
            <li key={g.id} className="flex flex-col border-b border-white/5 py-1 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-8 shrink-0 text-xs font-mono text-cyan-500/60">G{g.gate}</span>
              <div>
                <span className="font-semibold text-zinc-100">{g.name}</span>
                <span className="ml-1 text-xs text-zinc-500">({g.who})</span>
                <p className="text-xs text-zinc-500">{g.cfo}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/5 bg-zinc-950/60 p-4 sm:p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/70">Ministerial tax shield (housing)</h3>
        <p className="mt-1 text-xs text-zinc-500">If a staff row is a Minister, first payroll nudge is blocked without a board resolution in the vault (or the row flag). AI draft is a template—counsel should review.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-[10px] text-zinc-500">
            Proposed annual housing (nudge) $
            <input
              className="ml-1 w-24 rounded border border-white/10 bg-black/50 px-2 py-1 font-mono text-sm"
              value={proposedHousing}
              onChange={(e) => setProposedHousing(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={buildDraft}
            className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-[9px] font-bold uppercase text-cyan-200"
          >
            Build draft (template + nudge)
          </button>
          <Link
            className="text-[9px] font-bold uppercase text-cyan-400/80 hover:underline"
            href="/sovereign-vault"
            title="Store signed board packet under governance / tax"
          >
            Open Sovereign vault →
          </Link>
        </div>
        {draft && (
          <pre className="mt-3 max-h-64 overflow-auto rounded border border-white/5 bg-black/30 p-3 text-[10px] leading-relaxed text-zinc-300">{draft}</pre>
        )}
        <ul className="mt-4 space-y-2 text-xs">
          {rows
            .filter((r) => r.role_type === "Minister")
            .map((m) => {
              const a = assessHousingShield(m, vaultHousing);
              return (
                <li key={m.id} className="flex flex-col rounded-lg border border-white/5 p-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{m.full_name}</span>
                  <span className={a.ministerOnboardingBlocked ? "text-amber-200/80" : "text-emerald-500/80"}>
                    {a.ministerOnboardingBlocked ? "Shield: hold first payroll" : "Shield: nudge clear"}{" "}
                    {tenant ? "" : ""}
                  </span>
                </li>
              );
            })}
        </ul>
        {rows.filter((r) => r.role_type === "Minister").length === 0 && <p className="text-xs text-zinc-600">No minister rows — recruit above.</p>}
      </section>

      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Roster (employment status)</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-zinc-200">
            <thead className="text-[8px] uppercase text-zinc-500">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Role</th>
                <th className="p-2">Status</th>
                <th className="p-2">Tax</th>
                <th className="p-2">Nudge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const a = m.role_type === "Minister" ? assessHousingShield(m, vaultHousing) : { ministerOnboardingBlocked: false, message: "" };
                const fica = m.role_type === "Secular Staff" ? estimateEmployerFicaMatchYtd(0) : null;
                return (
                  <tr key={m.id} className="border-b border-white/5">
                    <td className="p-2 font-medium">{m.full_name}</td>
                    <td className="p-2 text-zinc-500">{m.role_type}</td>
                    <td className="p-2">{m.onboarding_status}</td>
                    <td className="p-2 text-[10px] text-zinc-500" title="W-4 / I-9 / W-9 per role">
                      {m.tax_form_status}
                    </td>
                    <td className="p-2 text-[9px] text-cyan-600/80" title="Simplistic nudge">
                      {m.role_type === "Minister" && a.ministerOnboardingBlocked
                        ? a.message.slice(0, 72) + "…"
                        : fica != null
                          ? `FICA nudge: $${fica} on $0 (post wages in hub).`
                          : m.role_type === "Contractor"
                            ? "1099 / $2K watchdog (contractor dashboard)"
                            : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <h4 className="text-lg font-bold">Recruit — {modal.title}</h4>
            <p className="text-[10px] text-zinc-500" title="Not exhaustive — see sovereignty gates.">
              Collect the forms in Gate 1 (W-4, I-9, etc.) for this lane.
            </p>
            <form onSubmit={onRecruit} className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="Full name"
                required
              />
              <input
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
                value={fDept}
                onChange={(e) => setFDept(e.target.value)}
                placeholder="Department (optional)"
              />
              <input
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
                type="date"
                value={fHire}
                onChange={(e) => setFHire(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-lg border border-white/10 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-cyan-500/80 py-2 text-xs font-bold text-black"
                >
                  {busy ? "…" : "Start onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
