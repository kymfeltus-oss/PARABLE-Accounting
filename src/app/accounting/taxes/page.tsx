import type { Metadata } from "next";
import Link from "next/link";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Taxes",
  description: "Payroll and compliance filings.",
};

const links: { href: string; label: string; sub: string }[] = [
  { href: "/quarterly-review", label: "EOQ 941 & remittance pulse", sub: "Form 941 cadence" },
  { href: "/compliance", label: "990 / UBI & board packet", sub: "Institutional compliance" },
  { href: "/cfo-summary", label: "CFO compliance board view", sub: "Governance layer" },
  { href: "/contractor-dashboard", label: "1099 contractor watch", sub: "W-9 & payee file" },
];

export default function AccountingTaxesPage() {
  return (
    <MinistryAppShell>
      <header className="mb-6 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--brand-cyber)]/80">Accounting · Tax</p>
        <h1 className="parable-header text-xl">Taxes</h1>
        <p className="mt-1 text-sm text-white/50">Payroll (941/944) and compliance filings — jump to existing institutional workspaces.</p>
      </header>
      <ul className="grid max-w-3xl gap-3 md:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-xl border border-white/10 bg-black/35 p-4 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.35)] hover:shadow-[0_0_24px_rgb(var(--brand-cyber-rgb)/0.08)]"
            >
              <p className="text-sm font-semibold text-white/90">{l.label}</p>
              <p className="mt-1 text-xs text-white/45">{l.sub}</p>
            </Link>
          </li>
        ))}
      </ul>
    </MinistryAppShell>
  );
}
