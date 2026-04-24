import type { Metadata } from "next";
import FinancialHub from "@/components/erp/FinancialHub";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Accounts Receivables",
  description: "Revenue streams & donation pledges.",
};

export default function AccountingArPage() {
  return (
    <MinistryAppShell>
      <header className="mb-6 max-w-4xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--brand-cyber)]/80">Accounting · AR</p>
        <h1 className="parable-header text-xl">Accounts Receivables</h1>
        <p className="mt-1 text-sm text-white/50">Revenue streams & donation pledges — unified financial hub below.</p>
      </header>
      <FinancialHub />
    </MinistryAppShell>
  );
}
