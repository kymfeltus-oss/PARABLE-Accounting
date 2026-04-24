import type { Metadata } from "next";
import ExpenseReceiptCapture from "@/components/erp/ExpenseReceiptCapture";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Expense reporting",
  description: "Mobile receipt capture and reimbursement pipeline.",
};

export default function AccountingExpensesPage() {
  return (
    <MinistryAppShell>
      <header className="mb-6 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--brand-cyber)]/80">Accounting · Expense</p>
        <h1 className="parable-header text-xl">Expense reporting</h1>
        <p className="mt-1 text-sm text-white/50">Mobile capture and reimbursement pipeline — local preview; connect storage in ops.</p>
      </header>
      <div className="max-w-2xl">
        <ExpenseReceiptCapture />
      </div>
    </MinistryAppShell>
  );
}
