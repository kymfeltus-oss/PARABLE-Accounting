import type { Metadata } from "next";
import ParableGivingDashboard from "@/components/giving/ParableGivingDashboard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Parable Giving",
  description: "Tithes, offerings, and Parable Pay — fund routing and congregational inflows.",
};

export default function GivingPage() {
  return (
    <MinistryAppShell>
      <div className="py-2 md:py-4">
        <ParableGivingDashboard />
      </div>
    </MinistryAppShell>
  );
}
