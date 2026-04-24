import type { Metadata } from "next";
import GeneralLedgerClient from "@/components/erp/GeneralLedgerClient";
import MinistryAppShell from "@/components/MinistryAppShell";
import Link from "next/link";

export const metadata: Metadata = {
  title: "General Ledger",
  description: "Institutional double-entry source of truth.",
};

export default function AccountingGlPage() {
  return (
    <MinistryAppShell>
      <header className="mb-6 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--brand-cyber)]/80">Accounting · GL</p>
        <h1 className="parable-header text-xl">General Ledger</h1>
        <p className="mt-1 text-sm text-white/50">
          Double-entry source of truth — pair exports with{" "}
          <Link href="/chart-of-accounts" className="text-[var(--brand-cyber)] underline">
            chart of accounts
          </Link>{" "}
          and month-end attestation in AI Close.
        </p>
      </header>
      <div className="parable-live-surface max-w-3xl rounded-2xl border border-white/10 p-6">
        <p className="text-sm text-white/60">Placeholder export while journal API integration is wired.</p>
        <GeneralLedgerClient />
      </div>
    </MinistryAppShell>
  );
}
