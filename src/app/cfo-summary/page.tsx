import type { Metadata } from "next";
import CfoSummary from "@/components/cfo/CfoSummary";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "CFO — Annual compliance summary",
  description: "Sovereign pillars, 941 history, and liquidity in one board-ready view.",
};

export default function CfoSummaryPage() {
  return (
    <MinistryAppShell>
      <CfoSummary />
    </MinistryAppShell>
  );
}
