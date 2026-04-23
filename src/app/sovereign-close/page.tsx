import type { Metadata } from "next";
import SovereignCloseWizard from "@/components/close/SovereignCloseWizard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Sovereign close",
  description: "Month-end close gates: data capture, AI shield, reconciliation, restricted funds, seal.",
};

export default function SovereignClosePage() {
  return (
    <MinistryAppShell>
      <SovereignCloseWizard />
    </MinistryAppShell>
  );
}
