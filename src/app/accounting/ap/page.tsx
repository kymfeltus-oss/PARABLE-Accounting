import type { Metadata } from "next";
import FinancialHub from "@/components/erp/FinancialHub";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Accounts Payable",
  description: "Vendor management & liability tracking.",
};

export default function AccountingApPage() {
  return (
    <MinistryAppShell>
      <header className="mb-6 max-w-4xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--brand-cyber)]/80">Accounting · AP</p>
        <h1 className="parable-header text-xl">Accounts Payable</h1>
        <p className="mt-1 text-sm text-white/50">Vendor management & liability tracking — same hub as AR for operational velocity.</p>
      </header>
      <FinancialHub />
    </MinistryAppShell>
  );
}
