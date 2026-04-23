import type { Metadata } from "next";
import IrsGuardian from "@/components/compliance/IrsGuardian";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "IRS Guardian",
  description: "AI compliance heuristics (Pub 1828), violations, and alert history.",
};

export default function IrsGuardianPage() {
  return (
    <MinistryAppShell>
      <IrsGuardian />
    </MinistryAppShell>
  );
}
