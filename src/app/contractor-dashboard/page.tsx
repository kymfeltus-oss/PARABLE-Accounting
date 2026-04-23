import type { Metadata } from "next";
import ContractorDashboard from "@/components/contractor/ContractorDashboard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "1099-NEC — Contractor watchdog",
  description: "W-9 vault, internal $2,000 watch, and corporation filter for service payees.",
};

export default function ContractorDashboardPage() {
  return (
    <MinistryAppShell>
      <ContractorDashboard />
    </MinistryAppShell>
  );
}
