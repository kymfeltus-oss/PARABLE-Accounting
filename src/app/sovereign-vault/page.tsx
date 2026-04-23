import type { Metadata } from "next";
import SovereignVaultV2 from "@/components/vault/SovereignVaultV2";
import MinistryAppShell from "@/components/MinistryAppShell";

export const metadata: Metadata = {
  title: "Sovereign vault",
  description: "Institutional document repository: governance, IRS, insurance, financials, continuity.",
};

export default function SovereignVaultPage() {
  return (
    <MinistryAppShell>
      <SovereignVaultV2 />
    </MinistryAppShell>
  );
}
