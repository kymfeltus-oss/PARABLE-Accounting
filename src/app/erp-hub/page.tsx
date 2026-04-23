import type { Metadata } from "next";
import FinancialHub from "@/components/erp/FinancialHub";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Financial hub — AP / AR / payroll",
  description: "Sub-ledger hub for payables, receivables, and month-end close.",
};

export default function ErpHubPage() {
  return (
    <MinistryAppShell>
      <FinancialHub />
    </MinistryAppShell>
  );
}
