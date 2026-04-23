import type { Metadata } from "next";
import AutoCloseDashboard from "@/components/close/AutoCloseDashboard";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Autonomous close",
  description: "Virtual controller: auto-book, compliance scan, reconciliation, restricted funds; live log then hand off to Gate 5.",
};

export default function AutonomousClosePage() {
  return (
    <MinistryAppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <AutoCloseDashboard />
      </div>
    </MinistryAppShell>
  );
}
