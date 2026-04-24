import type { Metadata } from "next";
import AccountingHubDashboard from "@/components/accounting/AccountingHubDashboard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Accounting",
  description: "Financial heart of the ministry — AP, AR, GL, tax, UCOA, controls, AI close, expenses.",
};

export default function AccountingHubPage() {
  return (
    <MinistryAppShell>
      <div className="py-2 md:py-6">
        <AccountingHubDashboard />
      </div>
    </MinistryAppShell>
  );
}
