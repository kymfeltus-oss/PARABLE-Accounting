import type { Metadata } from "next";
import AutonomousCloseEngine from "@/components/close/AutonomousCloseEngine";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Sovereign close",
  description: "Month-end close gates: data capture, AI shield, reconciliation, restricted funds, seal.",
};

export default function SovereignClosePage() {
  return (
    <MinistryAppShell>
      <AutonomousCloseEngine />
    </MinistryAppShell>
  );
}
