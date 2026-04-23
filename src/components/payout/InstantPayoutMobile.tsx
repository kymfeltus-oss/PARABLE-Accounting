"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { computeContractorYtdByPayee } from "@/lib/contractorYtdFromLedger";
import {
  executeGreenRoomPayout,
  isSixDigitPin,
  pickDefaultOperatingFundId,
} from "@/lib/mobilePayoutFromRoot.js";
import { NEC_TRACKING_THRESHOLD_USD } from "@/lib/contractorTrackerFromRoot.js";
import { evaluateHonorariumGates } from "@/lib/instantHonorariumFromRoot.js";

const LS_PIN = "parable_green_room_pin_v1";

type Payee = {
  id: string;
  display_name: string;
  payee_type: string;
  service_category: string;
  w9_on_file: boolean;
  metadata: Record<string, unknown> | null;
};

/**
 * Green Room: instant honorarium on mobile. PIN + 7100 ledger + watchdog.
 */
export default function InstantPayoutMobile() {
  const supabase = getSupabaseBrowser();
  const { tenant, ready } = useBrand();
  const [payees, setPayees] = useState<Payee[]>([]);
  const [ytdMap, setYtdMap] = useState<Record<string, number>>({});
  const [fundId, setFundId] = useState<string | null>(null);
  const [pid, setPid] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [devicePin, setDevicePin] = useState(""); // saved
  const [txPin, setTxPin] = useState(""); // per attempt
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const y0 = new Date().getUTCFullYear();
  const selected = useMemo(() => payees.find((p) => p.id === pid) ?? null, [payees, pid]);
  const ytd = selected ? ytdMap[selected.id] ?? 0 : 0;
  const nextAmt = Math.max(0, Number(amount) || 0);

  const load = useCallback(async () => {
    if (typeof localStorage !== "undefined") {
      setDevicePin(localStorage.getItem(LS_PIN) ?? "");
    }
    if (!supabase || !tenant?.id) return;
    setErr(null);
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("contractor_payees")
      .select("id, display_name, payee_type, service_category, w9_on_file, metadata")
      .eq("tenant_id", tenant.id)
      .order("display_name");
    if (error) {
      if (error.message.includes("metadata")) {
        const r2 = await supabase
          .schema("parable_ledger")
          .from("contractor_payees")
          .select("id, display_name, payee_type, service_category, w9_on_file")
          .eq("tenant_id", tenant.id);
        if (!r2.error && r2.data) {
          setPayees(
            (r2.data as Omit<Payee, "metadata">[]).map((p) => ({ ...p, metadata: null })),
          );
        } else {
          setErr(r2.error?.message ?? error.message);
        }
      } else {
        setErr(error.message);
      }
    } else {
      setPayees((data ?? []) as Payee[]);
    }
    const y = await computeContractorYtdByPayee(supabase, tenant.id, y0);
    setYtdMap(y);
    const { fundId: fid } = await pickDefaultOperatingFundId(supabase, tenant.id);
    if (fid) setFundId(fid);
  }, [supabase, tenant?.id, y0]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDevicePin = () => {
    if (!isSixDigitPin(devicePin)) {
      setErr("PIN must be exactly 6 digits.");
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_PIN, devicePin.replace(/\D/g, ""));
    }
    setStatus("Device PIN saved on this device.");
    setErr(null);
  };

  const onExecute = async () => {
    if (!supabase || !tenant?.id || !selected || !fundId) {
      setErr("Select payee, fund, and ensure tenant is loaded.");
      return;
    }
    setErr(null);
    setBusy(true);
    setStatus(null);
    const stored = typeof localStorage !== "undefined" ? (localStorage.getItem(LS_PIN) ?? "") : devicePin;
    const res = await executeGreenRoomPayout(supabase, {
      tenantId: tenant.id,
      fundId,
      contractorPayeeId: selected.id,
      ytd,
      w9OnFile: selected.w9_on_file,
      displayName: selected.display_name,
      payeeMetadata: (selected as Payee & { metadata?: object }).metadata,
      amount: nextAmt,
      pin: txPin,
      storedDevicePin: stored,
    });
    if (res.status === "OK" || res.status === "OK_LEDGER_WARN") {
      setStatus(
        (res as { w9?: boolean; detail?: string }).w9
          ? "Payout posted. W-9 nudge sent (stub) — next instant payout on hold for this payee until cleared."
          : "Payout posted to 7100 honorarium lane. Transfer rail is stub; ledger row is real.",
      );
      if ((res as { detail?: string }).detail) {
        setErr("Vault metadata update: " + (res as { detail: string }).detail);
      }
      setAmount("");
      setTxPin("");
      const y = await computeContractorYtdByPayee(supabase, tenant.id, y0);
      setYtdMap(y);
      void load();
    } else {
      setErr(
        (res as { error?: string }).error ||
          (res as { gate?: { reason?: string } }).gate?.reason ||
          (res as { error?: string }).error ||
          String(res),
      );
    }
    setBusy(false);
  };

  const preCheck = useMemo(() => {
    if (!selected || !nextAmt) return null;
    return evaluateHonorariumGates(ytd, nextAmt, selected.w9_on_file, NEC_TRACKING_THRESHOLD_USD);
  }, [selected, ytd, nextAmt]);
  const gateOk = preCheck == null || preCheck.allow;

  if (!ready) return <div className="p-4 text-sm text-zinc-500">Loading…</div>;

  return (
    <div
      className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#050505] p-4 text-white"
      style={{ background: "linear-gradient(180deg, #0a0f1a, #040404)" }}
    >
      <header className="shrink-0 border-b border-white/5 pb-4 pt-2 text-center">
        <h1 className="text-xl font-black uppercase italic leading-tight tracking-tighter" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
          Instant Honorarium
        </h1>
        <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.35em] text-cyan-500/80">Sovereign payout — Green Room</p>
        <p className="mt-1 text-[9px] text-zinc-600">Ledger: account 7100; watchdog + W-9 hold. Not tax advice.</p>
      </header>

      {err && (
        <p className="shrink-0 py-1 text-center text-xs text-amber-200/90" role="alert">
          {err}
        </p>
      )}
      {status && <p className="shrink-0 py-1 text-center text-xs text-emerald-200/80">{status}</p>}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-[9px] font-bold uppercase text-zinc-500">Step 0 — device PIN (once per browser)</p>
          <p className="text-[8px] text-zinc-600">Required before any payout. Stored only in this device&apos;s local storage.</p>
          <div className="mt-2 flex max-w-sm mx-auto gap-2">
            <input
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center font-mono text-sm tracking-widest"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={devicePin}
              onChange={(e) => setDevicePin(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              onClick={saveDevicePin}
              className="shrink-0 rounded-lg border border-cyan-500/30 px-2 py-1.5 text-[8px] font-bold uppercase text-cyan-200"
            >
              Save
            </button>
          </div>
        </section>

        {selected && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-[9px] font-bold uppercase text-zinc-500">Recipient</p>
            <h2 className="text-lg font-bold text-zinc-100">{selected.display_name}</h2>
            <span className="mt-1 inline-block rounded-full bg-cyan-400/15 px-2 py-0.5 text-[8px] font-bold uppercase text-cyan-300">
              {selected.service_category} · {selected.payee_type}
            </span>
            <p className="mt-1 text-[9px] text-zinc-500">W-9: {selected.w9_on_file ? "On file" : "Missing (watch 1099)"}</p>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-[8px] uppercase text-zinc-500">YTD 1099 watch</span>
            <span className="font-mono text-zinc-200">
              ${ytd.toFixed(0)} / ${NEC_TRACKING_THRESHOLD_USD}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (ytd / Math.max(1, NEC_TRACKING_THRESHOLD_USD)) * 100)}%`,
                background: "var(--brand-cyber, #22d3ee)",
                boxShadow: "0 0 8px color-mix(in srgb, var(--brand-cyber) 40%, transparent)",
              }}
            />
          </div>
          {preCheck && !preCheck.allow && preCheck.status === "BLOCKED" && (
            <p className="mt-1 text-[9px] text-amber-200/90">{String(preCheck.reason)}</p>
          )}
          {preCheck && preCheck.status === "CROSSING" && preCheck.allow && (
            <p className="mt-1 text-[9px] text-cyan-200/80">This pay crosses the $2,000 nudge. We&apos;ll W-9–hold the next one after you post (if still no W-9).</p>
          )}
        </div>

        <div className="px-1">
          <p className="text-[9px] font-bold uppercase text-zinc-500">Select contractor / guest</p>
          <select
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 py-2 pl-2 text-sm text-zinc-100"
            value={pid}
            onChange={(e) => setPid(e.target.value)}
          >
            <option value="">— choose —</option>
            {payees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-center">
          <p className="text-[9px] font-bold uppercase text-zinc-500">Amount to pay (USD)</p>
          <input
            className="w-full max-w-xs bg-transparent text-center text-4xl font-black tabular-nums text-white outline-none"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>

        <div>
          <p className="text-center text-[9px] font-bold uppercase text-zinc-500">Confirm PIN to execute</p>
          <input
            className="mx-auto block w-40 rounded-xl border border-white/10 bg-black/40 py-2 text-center font-mono text-lg tracking-[0.4em]"
            type="password"
            maxLength={6}
            inputMode="numeric"
            value={txPin}
            onChange={(e) => setTxPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
          />
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/5 bg-[#040404] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {fundId ? <p className="text-center text-[8px] text-zinc-600">Fund: {fundId.slice(0, 8)}… (COA 7100 on metadata)</p> : <p className="text-center text-xs text-amber-200/80">No fund — add ministry_funds</p>}
        <button
          type="button"
          disabled={!gateOk || busy || !pid || !fundId || !isSixDigitPin(devicePin) || !isSixDigitPin(txPin) || nextAmt < 0.01}
          onClick={onExecute}
          className="w-full rounded-2xl border border-cyan-400/40 py-4 text-sm font-black uppercase tracking-widest text-black disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: "var(--brand-cyber, #22d3ee)", boxShadow: "0 0 28px color-mix(in srgb, #22d3ee 0.3, transparent)" }}
        >
          {busy ? "…" : "Execute payout (ledger)"}
        </button>
      </div>
    </div>
  );
}
