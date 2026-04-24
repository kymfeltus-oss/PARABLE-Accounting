import type { Metadata } from "next";
import Link from "next/link";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Reporting",
  description: "Institutional intelligence and board packs.",
};

const tiles: { href: string; title: string; sub: string }[] = [
  { href: "/cfo-summary", title: "CFO compliance & board narrative", sub: "Institutional intelligence" },
  { href: "/quarterly-review", title: "EOQ & 941 pulse", sub: "Payroll tax cadence" },
  { href: "/sovereign-close", title: "Sovereign close (legacy path)", sub: "Also under Accounting → AI Close" },
  { href: "/import-export", title: "Data sovereignty exports", sub: "CSV / packet handoff" },
  { href: "/sovereign-accord", title: "Sovereign Accord", sub: "Governance alignment" },
];

export default function ReportingHubPage() {
  return (
    <MinistryAppShell>
      <header className="mb-6 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--brand-cyber)]/80">Reporting</p>
        <h1 className="parable-header text-xl">Institutional intelligence</h1>
        <p className="mt-1 text-sm text-white/50">Board packs, cadence filings, and export handoff — quick links into existing workspaces.</p>
      </header>
      <ul className="grid max-w-4xl gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="block h-full rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.35)] hover:shadow-[0_0_28px_rgb(var(--brand-cyber-rgb)/0.1)]"
            >
              <p className="text-sm font-bold text-white/95">{t.title}</p>
              <p className="mt-1 text-xs text-white/45">{t.sub}</p>
            </Link>
          </li>
        ))}
      </ul>
    </MinistryAppShell>
  );
}
