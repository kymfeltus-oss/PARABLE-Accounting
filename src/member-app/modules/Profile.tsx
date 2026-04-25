"use client";

import { useState } from "react";
import { useMemberPortalSession } from "../MemberPortalSessionContext";
import { SOVEREIGN } from "../styles";

export function Profile() {
  const {
    user,
    signInWithEmail,
    signOut,
    loadDemoMember,
    setDemoMode,
    linkedMember,
    sessionReady,
    tenantId,
    brandReady,
    brandError,
    tenantSlugEnv,
  } = useMemberPortalSession();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div
      className="mx-auto min-h-[min(70dvh,32rem)] w-full min-w-0 max-w-3xl space-y-4 p-4 pb-24 sm:p-6"
      style={{ background: SOVEREIGN.MATTE }}
    >
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">Profile</h2>
      <p className="text-xs text-white/40">1-tap payment methods are stored as Stripe/Plaid tokens in production. No card numbers in this app shell.</p>

      <div className="rounded-xl border border-white/10 px-3 py-2 text-[10px] text-white/55" style={{ background: SOVEREIGN.DEEP }}>
        <p className="font-bold uppercase tracking-widest text-white/35">Church (tenant)</p>
        <p className="mt-1.5 border-t border-white/5 pt-1.5 text-white/45">
          <span className="font-bold text-white/50">Environment check:</span> keep{" "}
          <span className="font-mono text-[#00FFFF]/90">NEXT_PUBLIC_TENANT_SLUG=parable-master</span> in{" "}
          <span className="font-mono">.env.local</span> (must match <span className="font-mono">parable_ledger.tenants.slug</span>
          ). Restart <span className="font-mono">npm run dev</span> after edits.
        </p>
        {!brandReady && <p className="mt-1">Loading organization…</p>}
        {brandReady && tenantId && <p className="mt-1 text-emerald-200/80">Connected — demo is ready.</p>}
        {brandReady && !tenantId && (
          <p className="mt-1 text-amber-200/90">
            Not connected. Current <span className="font-mono">NEXT_PUBLIC_TENANT_SLUG</span>:{" "}
            <span className="font-mono">{tenantSlugEnv?.trim() || "(unset — app defaults to parable-master)"}</span>
            {brandError ? ` — ${brandError}` : ""}. In Supabase SQL Editor run{" "}
            <span className="font-mono">select slug from parable_ledger.tenants;</span> — if there is no{" "}
            <span className="font-mono">parable-master</span> row, run <span className="font-mono">fix_tenant_slug.sql</span>{" "}
            (it inserts one) or apply migration <span className="font-mono">20260423170000_seed_tenant_parable_master_if_missing.sql</span>
            , then <span className="font-mono">NOTIFY pgrst, &apos;reload schema&apos;;</span>. If a different slug appears, set the env var to match it.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 p-3" style={{ background: SOVEREIGN.DEEP }}>
        <p className="text-[9px] font-bold uppercase text-white/40">Session</p>
        {!sessionReady && <p className="text-xs text-white/50">Loading…</p>}
        {user && <p className="text-sm text-white/80">{user.email}</p>}
        {linkedMember && <p className="text-sm text-white/60">Roster: {linkedMember.full_name}</p>}

        <label className="mt-2 block text-[9px] uppercase text-white/35" htmlFor="mpemail">
          Magic link (email)
        </label>
        <input
          id="mpemail"
          type="email"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@ministry.org"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#0a0a0a]"
            style={{ background: SOVEREIGN.GLOW }}
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setMsg(null);
              const e = await signInWithEmail(email);
              setMsg(e || "Check your email for the sign-in link.");
              setLoading(false);
            }}
          >
            Send magic link
          </button>
          {user && (
            <button type="button" className="text-xs text-white/50 underline" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </div>
        <div className="mt-3 border-t border-white/5 pt-3">
          <button
            type="button"
            disabled={!brandReady || !tenantId}
            title={!brandReady ? "Wait for tenant" : !tenantId ? "Fix NEXT_PUBLIC_TENANT_SLUG" : undefined}
            onClick={async () => {
              setDemoMode(true);
              setMsg(null);
              const r = await loadDemoMember();
              setMsg(
                r.ok
                  ? "Demo: first roster member loaded. Open Home → GIVE to try the flow (anon key)."
                  : (r.reason ?? "Could not load a demo member.")
              );
            }}
            className="w-full rounded-lg border border-amber-500/30 py-2 text-xs font-bold text-amber-200/80 enabled:hover:border-amber-400/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Demo (preview as member, anon)
          </button>
        </div>
        {msg && (
          <p
            className={`mt-2 text-xs ${msg.startsWith("Demo:") ? "text-emerald-200/80" : "text-amber-200/90"}`}
            role="status"
          >
            {msg}
          </p>
        )}
      </div>

      <div
        className="rounded-2xl border p-3"
        style={{ borderColor: "color-mix(in srgb, #00FFFF 15%, #333)" }}
      >
        <p className="text-[9px] font-bold uppercase text-white/40">Saved methods (vault)</p>
        <p className="mt-1 text-sm text-white/70">VISA ···· 4242 · default</p>
        <p className="text-[9px] text-white/30">Plaid: bank connect · Stripe: cards — wire in services/prod</p>
      </div>
    </div>
  );
}
