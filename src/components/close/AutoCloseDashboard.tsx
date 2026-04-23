"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { runScheduledAutoSeal } from "@/lib/autonomousFromRoot.js";

type LogLine = { t: string; text: string; kind: "info" | "ok" | "warn" | "err" | "run" };

function nowTime() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AutoCloseDashboard() {
  const { tenant } = useBrand();
  const supabase = getSupabaseBrowser();
  const [log, setLog] = useState<LogLine[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [vault, setVault] = useState<string | null>(null);

  const push = useCallback((line: Omit<LogLine, "t">) => {
    setLog((prev) => [...prev, { t: nowTime(), ...line }].slice(-80));
  }, []);

  const runEngine = useCallback(
    async (force: boolean) => {
      if (!tenant?.id) {
        push({ text: "No tenant; configure NEXT_PUBLIC_TENANT_SLUG and Supabase.", kind: "err" });
        return;
      }
      setRunning(true);
      setLog([]);
      setOutcome(null);
      setVault(null);

      let comp = { openViolationCount: 0, criticalCount: 0 };
      if (supabase) {
        const { data } = await supabase
          .schema("parable_ledger")
          .from("compliance_violation_alerts")
          .select("status, risk_level")
          .eq("tenant_id", tenant.id)
          .limit(200);
        const a = (data ?? []) as { status: string; risk_level: string }[];
        const o = a.filter((x) => x.status !== "resolved");
        comp = {
          openViolationCount: o.length,
          criticalCount: o.filter((x) => x.risk_level === "CRITICAL").length,
        };
      }

      const demoCoa = [{ account_code: 4020 }, { account_code: 6050 }, { account_code: 7100 }, { account_code: 4010 }];

      const c = new Date();
      const ym = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`;

      const res = await runScheduledAutoSeal(
        tenant.id,
        ym,
        {
          force, // off-calendar: same as production runner but bypasses 1st-of-month guard
          autoBook: {
            bankLines: [
              { description: "Payout Twitch Interactive", amount: 1200 },
              { description: "Duke Energy — electric", amount: 400 },
            ],
            coa: demoCoa,
          },
          compliance: comp,
          reconcile: { recState: { perfectMatches: 12, fuzzyMatches: 0 } },
          stewardship: { noDeficitLeak: true, releaseMatchesExpense: true },
          onStep: (e: { gate?: string; at?: string; result?: { status: string; message?: string } }) => {
            const g = e.gate ?? "?";
            const s = e.result?.status ?? "";
            const kind: LogLine["kind"] = s === "CLEARED" || s === "PENDING_VAULT" || s === "PREPARED" ? "ok" : s === "PAUSED" || s === "REVIEW" ? "warn" : "run";
            push({ text: `→ ${g} [${s}]${e.result?.message ? " — " + e.result.message : ""}`, kind });
          },
        } as never
      );

      if (res && typeof (res as { run?: boolean }).run === "boolean" && (res as { run: boolean }).run === false) {
        push({ text: (res as { message?: string }).message ?? "Scheduler: not the 1st; pass force to run off-calendar.", kind: "warn" });
        setOutcome("SKIPPED");
        setRunning(false);
        return;
      }

      const st = (res as { status: string; vault?: { suggestedVaultKey?: string }; data?: { board_package?: { suggestedVaultKey?: string } } })
        .status;
      setOutcome(st);
      const v =
        (res as { vault?: { suggestedVaultKey: string } }).vault?.suggestedVaultKey ||
        (res as { data?: { board_package?: { suggestedVaultKey: string } } })?.data?.board_package?.suggestedVaultKey;
      if (v) setVault(v);

      if (st === "READY_FOR_SEAL") {
        push({ text: "Virtual controller: READY FOR SEAL — hand off to human dual signature (Sovereign Close).", kind: "ok" });
      } else if (st === "PAUSED") {
        push({ text: "Sequence PAUSED — compliance. Treasurer alert dispatched (or console in dev).", kind: "warn" });
      } else {
        push({ text: `Result: ${st} — see bottlenecks in console if needed.`, kind: "warn" });
      }
      setRunning(false);
    },
    [push, supabase, tenant?.id]
  );

  useEffect(() => {
    push({ text: "Autonomous close engine — idle. Run to stream gate execution.", kind: "info" });
  }, [push]);

  return (
    <div className="rounded-3xl border border-white/5 bg-[#050505] p-6 shadow-2xl sm:p-10" style={{ boxShadow: "0 0 40px color-mix(in srgb, var(--brand-cyber, #00f2ff) 0.06%, transparent)" }}>
      <div className="mb-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-black uppercase italic tracking-tighter text-white sm:text-2xl">Autonomous close engine</h2>
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 animate-pulse rounded-full"
            style={{ backgroundColor: "var(--brand-glow, #22d3ee)", boxShadow: "0 0 8px var(--brand-glow, #22d3ee)" }}
          />
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
            {running ? "Controller running" : "AI controller standby"}
          </span>
        </div>
      </div>

      <p className="text-xs text-white/50">
        On the <strong>1st of the month</strong> (or with <em>Test run</em> off-calendar), the Virtual Controller chains Auto-Book, IRS Guardian, reconciliation, and stewardship, then
        stages the board pack descriptor for the <strong>vault</strong>.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running}
          onClick={() => {
            void runEngine(true);
          }}
          className="rounded-full border border-cyan-500/30 px-4 py-1.5 text-[10px] font-bold tracking-widest text-cyan-200 disabled:opacity-50"
        >
          Run virtual controller
        </button>
        <button
          type="button"
          disabled
          className="rounded-full border border-zinc-700 px-3 py-1.5 text-[9px] text-zinc-500"
          title="Bind to your scheduler (Vercel cron / worker) for true 1st-of-month"
        >
          24/7 scheduler: wire in production
        </button>
      </div>

      <div className="mt-6 space-y-1 font-mono text-[11px] text-white/50">
        {log.map((l, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <span className="text-white/30">[{l.t}]</span>
            <span
              className={
                l.kind === "ok"
                  ? "text-cyan-400/90"
                  : l.kind === "warn"
                    ? "text-amber-200/80"
                    : l.kind === "err"
                      ? "text-red-400"
                      : "text-white/70"
              }
            >
              {l.text}
            </span>
          </div>
        ))}
        {running && (
          <div className="text-cyan-200/50 animate-pulse" suppressHydrationWarning>
            [{nowTime()}] working…
          </div>
        )}
      </div>

      {vault && <p className="mt-4 break-all text-[9px] text-zinc-500">Vault hand-off: {vault}</p>}
      {outcome && <p className="mt-1 text-xs text-zinc-400">State: {outcome}</p>}

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="mb-4 text-xs text-white/60 italic">
          When the engine reaches <span className="not-italic text-cyan-200/90">READY_FOR_SEAL</span>, the month-end package is only missing human dual signature. Open Sovereign
          Close to complete Gate 5.
        </p>
        <Link
          href="/sovereign-close"
          className="inline-block w-full max-w-md rounded-xl bg-cyan-400 py-4 text-sm font-black tracking-widest text-black uppercase transition-all hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
        >
          Review &amp; sign — sovereign close
        </Link>
      </div>
    </div>
  );
}
