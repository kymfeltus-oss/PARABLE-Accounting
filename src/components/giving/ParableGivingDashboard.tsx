"use client";

import Link from "next/link";
import { useAuditMode } from "@/context/AuditModeContext";
import { useBrand } from "@/components/branding/BrandProvider";
import FoundryNavIcon from "@/components/FoundryNavIcon";
import ParablePay from "./ParablePay";

const ACTIONS: { href: string; label: string; sub: string }[] = [
  { href: "/member-hub", label: "Member hub", sub: "Roster, stewardship, donor context" },
  { href: "/erp-hub", label: "Financial hub", sub: "Tithe checkout, Plaid, AP / AR" },
  { href: "/chart-of-accounts", label: "Chart of accounts", sub: "UCOA — 4010 tithes, cash lines" },
  { href: "/compliance", label: "IRS Guardian", sub: "Policy checks on inflows & lanes" },
];

/**
 * Parable Giving — own surface for congregational inflows (Stripe, Parable Pay GL, fund routing).
 */
export default function ParableGivingDashboard() {
  const { tenant } = useBrand();
  const { auditMode } = useAuditMode();
  const org = tenant?.display_name ?? "Your ministry";

  const card = auditMode
    ? "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
    : "rounded-2xl border border-white/10 bg-black/35 p-5 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.28)] hover:shadow-[0_0_32px_rgb(var(--brand-cyber-rgb)/0.08)]";
  const titleC = auditMode ? "text-neutral-900" : "text-white/95";
  const subC = auditMode ? "text-neutral-600" : "text-white/45";
  const labelC = auditMode ? "text-neutral-500" : "text-white/40";

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-6">
      <header className="text-center md:text-left">
        <div className="mb-3 flex items-center justify-center gap-2 md:justify-start">
          <span className={["rounded-lg border p-2", auditMode ? "border-neutral-200 bg-white" : "border-white/10 bg-white/[0.04]"].join(" ")}>
            <FoundryNavIcon name="gift" size={28} />
          </span>
        </div>
        <p
          className={["text-[10px] font-bold uppercase tracking-[0.32em]", labelC].join(" ")}
          style={auditMode ? undefined : { color: "rgb(var(--brand-cyber-rgb) / 0.88)" }}
        >
          Parable Giving
        </p>
        <h1
          className={[
            "mt-2 text-2xl sm:text-3xl",
            auditMode ? "font-black uppercase italic tracking-tighter text-neutral-900" : "parable-header",
          ].join(" ")}
        >
          {org}
        </h1>
        <p className={["mt-3 max-w-2xl text-sm leading-relaxed", subC].join(" ")}>
          One dashboard for <strong className="font-semibold text-[var(--brand-cyber)]/90">tithes, offerings, and fund routing</strong> — from Member Hub through Stripe checkout, Parable
          Pay (secured contributions → <span className="font-mono text-xs">1010/4010</span> GL when SECURED), and the sovereign ledger.
        </p>
      </header>

      {!auditMode && (
        <section>
          <h2 className={["mb-4 text-[10px] font-bold uppercase tracking-[0.25em]", labelC].join(" ")}>Givlify-style flow</h2>
          <p className={["mb-4 max-w-2xl text-xs", subC].join(" ")}>Sovereign tech-noir: matte black, #00FFFF glow, 1-tap path — connect payments to go live.</p>
          <ParablePay />
        </section>
      )}

      <section>
        <h2 className={["mb-4 text-[10px] font-bold uppercase tracking-[0.25em]", labelC].join(" ")}>Jump in</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className={["flex h-full flex-col", card].join(" ")}>
                <p className={["text-sm font-bold", titleC].join(" ")}>{a.label}</p>
                <p className={["mt-1 flex-1 text-xs leading-relaxed", subC].join(" ")}>{a.sub}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={[
          "rounded-2xl border p-5",
          auditMode ? "border-neutral-200 bg-neutral-50" : "border-white/[0.08] bg-white/[0.02]",
        ].join(" ")}
      >
        <h2 className={["text-[10px] font-bold uppercase tracking-[0.25em]", labelC].join(" ")}>AR ledger (Parable Pay)</h2>
        <p className={["mt-2 text-sm leading-relaxed", subC].join(" ")}>
          <span className="font-mono text-xs">1-Tap give</span> inserts <span className="font-mono text-xs">parable_ledger.member_contributions</span>{" "}
          (SECURED) and the DB trigger posts <span className="font-mono text-xs">Dr 1010 / Cr 4010</span> to{" "}
          <span className="font-mono text-xs">general_ledger</span>. The Accounting → AR live feed and Member hub stewardship views update in real time.
        </p>
      </section>
    </div>
  );
}
