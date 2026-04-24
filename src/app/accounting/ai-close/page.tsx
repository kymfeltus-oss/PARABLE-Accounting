import type { Metadata } from "next";
import AutonomousCloseEngine from "@/components/close/AutonomousCloseEngine";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "AI Close",
  description: "4-gate autonomous month-end close engine (Sovereign).",
};

/** Same experience as /sovereign-close — AutonomousCloseEngine (Sovereign close wizard + checklist). */
export default function AccountingAiClosePage() {
  return (
    <MinistryAppShell>
      <AutonomousCloseEngine />
    </MinistryAppShell>
  );
}
