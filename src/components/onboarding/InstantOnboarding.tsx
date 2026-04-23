"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyTenantCssVars } from "@/lib/brandCss";
import { setupInstantGoLive } from "@/lib/autoPilotRouter";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";

const NEON_PRESETS = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#fb7185"] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

function starterGlowHex(displayName: string): string {
  if (!displayName.trim()) return NEON_PRESETS[0];
  return NEON_PRESETS[hashString(displayName.trim()) % NEON_PRESETS.length]!;
}

function makeSlug(part: string): string {
  const base = part
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const short = (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 6)
    : `x${Date.now().toString(36)}`
  ).replace(/-/g, "");
  return [base || "church", short].filter(Boolean).join("-");
}

type BootItem = { id: string; label: string; sub: string; ready: boolean };

export default function InstantOnboarding() {
  const supabase = getSupabaseBrowser();
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const sealedAutopilot = useRef(false);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [ein, setEin] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [bootItems, setBootItems] = useState<BootItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autopilot, setAutopilot] = useState<string | null>(null);

  const glow = useMemo(() => starterGlowHex(displayName), [displayName]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    applyTenantCssVars(document.documentElement, glow, "#050505", glow);
  }, [glow]);

  const onProvision = useCallback(async () => {
    if (!supabase) {
      setError("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.");
      return;
    }
    setError(null);
    const { data: session, error: sessErr } = await supabase.auth.getUser();
    if (sessErr || !session?.user) {
      setError("Sign in to create a tenant (or run INSERT via service role in the dashboard).");
      return;
    }
    const slug = makeSlug(displayName || "ministry");
    const { data: row, error: insErr } = await supabase
      .schema("parable_ledger")
      .from("tenants")
      .insert({
        slug,
        display_name: displayName.trim() || "New ministry",
        legal_name: legalName.trim() || null,
        tax_id_ein: ein.trim() || null,
        primary_color: glow,
        accent_color: "#050505",
      })
      .select("id")
      .single();

    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (!row?.id) {
      setError("Insert returned no id.");
      return;
    }
    sealedAutopilot.current = false;
    setAutopilot(null);
    setBootItems([
      { id: "f_gen", label: "General fund", sub: "GEN — unrestricted", ready: false },
      { id: "f_bld", label: "Building fund", sub: "BLD — restricted", ready: false },
      { id: "f_msn", label: "Missions", sub: "MSN — restricted", ready: false },
      { id: "shield", label: "IRS compliance shield", sub: "COA routes + Sovereign Accord mandates", ready: false },
    ]);
    setTenantId(row.id);
    setPhase(2);
  }, [supabase, displayName, legalName, ein, glow]);

  useEffect(() => {
    if (phase !== 2 || !supabase || !tenantId) return;
    const poll = () => {
      void (async () => {
        const { count: fundCount, error: e1 } = await supabase
          .schema("parable_ledger")
          .from("ministry_funds")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        const { count: mandateCount, error: e2 } = await supabase
          .schema("parable_ledger")
          .from("compliance_mandates")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        const { count: coaCount, error: e3 } = await supabase
          .schema("parable_ledger")
          .from("tenant_irs_coa_routes")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        if (e1) setError(e1.message);
        if (e2) setError(e2.message);
        if (e3) setError(e3.message);
        const fc = fundCount ?? 0;
        const mc = mandateCount ?? 0;
        const cc = coaCount ?? 0;
        setBootItems((prev) =>
          prev.map((b) => {
            if (b.id === "f_gen") return { ...b, ready: fc >= 1 };
            if (b.id === "f_bld") return { ...b, ready: fc >= 2 };
            if (b.id === "f_msn") return { ...b, ready: fc >= 3 };
            if (b.id === "shield") return { ...b, ready: mc >= 4 && cc >= 1 };
            return b;
          }),
        );
        if (fc >= 4 && mc >= 4 && cc >= 1 && !sealedAutopilot.current) {
          sealedAutopilot.current = true;
          const ap = await setupInstantGoLive(tenantId);
          setAutopilot(`${ap.status} — ${ap.defaultIrsStance.slice(0, 120)}…`);
          setPhase(3);
        }
      })();
    };
    poll();
    const id = window.setInterval(poll, 900);
    return () => window.clearInterval(id);
  }, [phase, supabase, tenantId]);

  const allBootReady = useMemo(
    () => bootItems.length > 0 && bootItems.every((b) => b.ready),
    [bootItems],
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#020203] text-white"
      style={{
        backgroundImage: `radial-gradient(1200px_600px_at_50%_-10%, color-mix(in srgb, ${glow} 12%, transparent), #020203)`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.12] [background-image:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.04)_2px,rgba(255,255,255,0.04)_3px)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.5em] text-white/40">Sovereign OS</p>
        <h1 className="mt-2 text-center text-2xl font-black uppercase italic tracking-tight text-white sm:text-3xl">
          Instant activation
        </h1>
        <p className="mt-2 text-center text-sm text-white/50">Download, deploy, route revenue — no spreadsheet lift.</p>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {phase === 1 ? (
              <motion.section
                key="p1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 rounded-2xl border border-white/10 bg-black/30 p-6 shadow-[0_0_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-white/50">Phase 1 — Brand</h2>
                <label className="block text-xs uppercase tracking-widest text-white/40">
                  Ministry display name
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-[color:rgb(var(--brand-glow-rgb)/0.5)]"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Grace River Church"
                    autoFocus
                  />
                </label>
                <label className="block text-xs uppercase tracking-widest text-white/40">
                  Legal name (optional, for 990 / resolutions)
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Grace River Church, Inc."
                  />
                </label>
                <label className="block text-xs uppercase tracking-widest text-white/40">
                  EIN (optional, XX-XXXXXXX)
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white"
                    value={ein}
                    onChange={(e) => setEin(e.target.value)}
                    placeholder="00-0000000"
                  />
                </label>
                <p className="text-xs text-white/45">
                  <span className="font-semibold" style={{ color: glow }}>
                    Starter glow
                  </span>{" "}
                  updates from your name. Your tenant will save this as its primary color.
                </p>
                <button
                  type="button"
                  onClick={() => void onProvision()}
                  className="w-full rounded-xl border border-[color:rgb(var(--brand-glow-rgb)/0.45)] bg-[color:rgb(var(--brand-glow-rgb)/0.1)] py-3 text-sm font-bold uppercase tracking-wide text-[color:rgb(var(--brand-glow-rgb))] transition hover:bg-[color:rgb(var(--brand-glow-rgb)/0.18)]"
                >
                  Deploy & power up
                </button>
              </motion.section>
            ) : null}

            {phase === 2 || phase === 3 ? (
              <motion.section
                key="p2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4 rounded-2xl border border-white/10 bg-black/35 p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
              >
                <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-white/50">
                  Phase 2 — Fund provisioning
                </h2>
                <p className="text-xs text-white/45">Genesis routine is writing funds, compliance mandates, and 990/990-T routing to your tenant.</p>
                <ul className="space-y-3">
                  {bootItems.map((b, idx) => (
                    <motion.li
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-3"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0, transition: { delay: 0.05 * idx } }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white/90">{b.label}</p>
                        <p className="text-[10px] uppercase tracking-wide text-white/40">{b.sub}</p>
                      </div>
                      <div className="h-2 w-12 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className="h-2 rounded-full"
                          style={{ backgroundColor: glow, boxShadow: `0 0 14px ${glow}` }}
                          initial={{ width: "8%" }}
                          animate={{ width: b.ready ? "100%" : "35%" }}
                          transition={{ duration: b.ready ? 0.4 : 1, repeat: b.ready ? 0 : Infinity, repeatType: "reverse" }}
                        />
                      </div>
                    </motion.li>
                  ))}
                </ul>
                {allBootReady && phase === 2 ? <p className="text-center text-xs text-white/50">Stabilizing ledger…</p> : null}
                {phase === 3 ? (
                  <div className="pt-2">
                    <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-white/50">Phase 3 — Stream link</h2>
                    <p className="mt-2 text-xs text-white/45">
                      The stream router can post to your <strong>GEN</strong> (general) fund with IRS audit fields on. Wire your webhook to the Edge
                      function; revenue lands immediately after genesis.
                    </p>
                    {autopilot ? <p className="mt-2 text-[11px] leading-relaxed text-white/55">{autopilot}</p> : null}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <a
                        href="https://supabase.com/docs/guides/functions"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-center text-sm font-semibold text-white/85 transition hover:border-[color:rgb(var(--brand-glow-rgb)/0.4)]"
                      >
                        Open Edge deploy docs
                      </a>
                      <Link
                        href="/compliance"
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-[color:rgb(var(--brand-glow-rgb)/0.45)] py-2.5 text-center text-sm font-bold text-[color:rgb(var(--brand-glow-rgb))] transition hover:bg-[color:rgb(var(--brand-glow-rgb)/0.12)]"
                      >
                        Open compliance cockpit
                      </Link>
                    </div>
                    <p className="mt-3 text-center text-[10px] text-white/35">Supabase: deploy `supabase/functions/stream-to-ledger` with your project.</p>
                  </div>
                ) : null}
              </motion.section>
            ) : null}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
