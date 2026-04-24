"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess, type PlaidLinkError } from "react-plaid-link";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";

type Hub = "idle" | "linking" | "exchanging" | "syncing" | "ok" | "err";

/**
 * Plaid Link + exchange + one transactions sync. Imports land in `parable_ledger.transactions` / `erp_ledger` as
 * `metadata.parable_verification_state = "unverified"` (CFO Autonomous Close gate).
 */
export default function PlaidLinkPanel() {
  const { tenant, ready: brandReady } = useBrand();
  const supabase = getSupabaseBrowser();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [hub, setHub] = useState<Hub>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("anonymous");
  const opened = useRef(false);
  const successInFlight = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) {
        setUserId(user.id);
      }
    });
  }, [supabase]);

  const onSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken) => {
      if (!tenant?.id) {
        return;
      }
      successInFlight.current = true;
      setHub("exchanging");
      setMsg("Linking item…");
      try {
        const ex = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, tenantId: tenant.id }),
        });
        if (!ex.ok) {
          const b = (await ex.json().catch(() => ({}))) as { error?: string };
          setHub("err");
          setMsg(b.error ?? "Exchange failed");
          return;
        }
        setHub("syncing");
        setMsg("Syncing first batch…");
        const sy = await fetch("/api/plaid/sync-transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: tenant.id }),
        });
        const syJson = (await sy.json().catch(() => ({}))) as { inserted?: number; error?: string; errors?: string[] };
        if (!sy.ok) {
          setHub("err");
          setMsg(syJson.error ?? "Sync failed");
          return;
        }
        setHub("ok");
        setMsg(
          `Plaid: imported ${syJson.inserted ?? 0} new row(s) — all flagged Unverified for Autonomous Close.`
        );
        setLinkToken(null);
      } finally {
        successInFlight.current = false;
      }
    },
    [tenant?.id]
  );

  const onExit = useCallback(
    (err: PlaidLinkError | null) => {
      opened.current = false;
      if (err) {
        successInFlight.current = false;
        setMsg(
          (err as PlaidLinkError & { display_message?: string; error_message?: string }).display_message ||
            (err as { error_message?: string }).error_message ||
            "Plaid exit"
        );
        setHub("err");
        return;
      }
      if (successInFlight.current) {
        return;
      }
      setMsg(null);
      setHub("idle");
    },
    []
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (!linkToken) {
      opened.current = false;
    }
  }, [linkToken]);

  useEffect(() => {
    if (linkToken && ready && !opened.current) {
      opened.current = true;
      open();
    }
  }, [linkToken, ready, open]);

  const startLink = useCallback(async () => {
    if (!tenant?.id) {
      setMsg("Set tenant in Brand context to connect Plaid.");
      return;
    }
    setMsg(null);
    setHub("linking");
    setLinkToken(null);
    const r = await fetch("/api/plaid/create-link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: tenant.id, userId }),
    });
    if (!r.ok) {
      const b = (await r.json().catch(() => ({}))) as { error?: string };
      setHub("err");
      setMsg(b.error ?? "Could not get link token (check PLAID_* in env).");
      return;
    }
    const b = (await r.json()) as { link_token: string };
    setLinkToken(b.link_token);
  }, [tenant?.id, userId]);

  if (!brandReady) {
    return null;
  }
  if (!tenant?.id) {
    return (
      <p className="text-sm text-zinc-500">
        Resolve tenant to use Plaid (e.g. <code className="text-zinc-400">NEXT_PUBLIC_TENANT_SLUG</code>).
      </p>
    );
  }

  return (
    <div
      className="rounded-3xl border border-white/10 p-5 sm:p-6"
      style={{ background: "radial-gradient(100% 80% at 50% 0, rgba(0,242,255,0.04) 0, #080808 100%)" }}
    >
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Bank link (Plaid)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Connect a bank to push transactions into the <code className="text-cyan-200/80">erp_ledger</code> view. Imports are
        <span className="ml-1 font-bold text-amber-200/90">Unverified</span> until the Autonomous Close Virtual Controller clears them.
      </p>
      <button
        type="button"
        onClick={() => void startLink()}
        disabled={hub === "linking" || hub === "exchanging" || hub === "syncing"}
        className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-cyan-200 disabled:opacity-50"
        style={{ boxShadow: "0 0 20px color-mix(in srgb, var(--brand-glow) 15%, transparent)" }}
      >
        {hub === "linking" ? "Open Plaid…" : hub === "exchanging" ? "Linking…" : hub === "syncing" ? "Syncing…" : "Connect bank account"}
      </button>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}
