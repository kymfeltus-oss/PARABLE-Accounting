"use client";

import { useState } from "react";

const MIN_CENTS = 100;
/** Must match UCOA tithes line; duplicated here so the client bundle does not import `stripe` SDK. */
const TITHE_UCOA = "4010";

type Props = { tenantId: string };

/**
 * One-click tithe: Checkout Session with `metadata.parable_account_code = 4010` (or override) for the Auto-Booker.
 */
export default function TitheCheckoutButton({ tenantId }: Props) {
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPay = async () => {
    setErr(null);
    const dollars = Number.parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars * 100 < MIN_CENTS) {
      setErr("Enter an amount of at least $1.00.");
      return;
    }
    const amountCents = Math.round(dollars * 100);
    setBusy(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          amountCents,
          accountCode: TITHE_UCOA,
          successUrl: `${origin}/erp-hub?tithe=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/erp-hub?tithe=cancel`,
        }),
      });
      const b = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setErr(b.error ?? "Checkout could not be created (STRIPE_SECRET_KEY?).");
        return;
      }
      if (b.url) {
        window.location.assign(b.url);
      } else {
        setErr("No redirect URL from Stripe.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-3xl border border-white/10 p-5 sm:p-6"
      style={{ background: "radial-gradient(100% 80% at 50% 0, rgba(0,242,255,0.04) 0, #080808 100%)" }}
    >
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Tithes (Stripe Checkout)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Session + PaymentIntent metadata use UCOA <code className="text-cyan-200/80">{TITHE_UCOA}</code> (Tithes &amp;
        offerings). Webhook with <code className="text-cyan-200/80">SUPABASE_SERVICE_ROLE_KEY</code> posts a donation row.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[10px] font-bold uppercase text-zinc-500">
          Amount (USD)
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="ml-2 w-24 rounded border border-zinc-700 bg-black/40 px-2 py-1 font-mono text-sm text-white"
          />
        </label>
        <button
          type="button"
          onClick={() => void onPay()}
          disabled={busy}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-200 disabled:opacity-50"
        >
          {busy ? "Redirecting…" : "Pay tithe (4010 in metadata)"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-300/90">{err}</p>}
    </div>
  );
}
