import type { Metadata } from "next";
import MinistryAppShell from "@/components/MinistryAppShell";
import SovereignAccord from "@/components/sovereign-accord/SovereignAccord";

export const metadata: Metadata = {
  title: "Sovereign Accord — PARABLE Accounting",
  description: "Board compliance mandates, housing shield, and audit-ready locks.",
};

export default function SovereignAccordPage() {
  return (
    <MinistryAppShell>
      <SovereignAccord />
    </MinistryAppShell>
  );
}
